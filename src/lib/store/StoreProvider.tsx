"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { seedDatabase } from "@/lib/seed";
import type {
  Database,
  Group,
  Transaction,
  Message,
  Nudge,
  Payment,
  Settings,
  Student,
} from "@/lib/types";
import {
  buildMessages,
  dueNudges,
  specFromNudge,
  type SendSpec,
} from "@/lib/engine/send";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { localStore } from "./localStore";
import { SupabaseStore } from "./supabaseStore";

/**
 * `cloud` means signed in to Supabase and syncing across devices.
 * `local` is the fallback when no project is configured — this browser only.
 */
export type StoreMode = "cloud" | "local";

interface StoreValue {
  db: Database;
  ready: boolean;
  mode: StoreMode;
  /** In cloud mode, false until someone signs in. Always true in local mode. */
  signedIn: boolean;
  email: string | null;

  signUp(name: string, email: string, password: string): Promise<string | null>;
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;

  addGroup(g: Omit<Group, "id" | "createdAt">): void;
  updateGroup(id: string, patch: Partial<Group>): void;
  removeGroup(id: string): void;
  addPayment(p: Omit<Payment, "id" | "createdAt">): void;
  addTransaction(t: Omit<Transaction, "id" | "createdAt">): void;
  removeTransaction(id: string): void;
  removePayment(id: string): void;
  addStudent(s: Omit<Student, "id" | "createdAt" | "lastContactedAt">): void;
  updateStudent(id: string, patch: Partial<Student>): void;
  removeStudent(id: string): void;
  addNudge(n: Omit<Nudge, "id" | "createdAt">): void;
  updateNudge(id: string, patch: Partial<Nudge>): void;
  removeNudge(id: string): void;
  updateMessage(id: string, patch: Partial<Message>): void;
  updateSettings(patch: Partial<Settings>): void;
  sendNow(spec: SendSpec): { queued: number; skippedByCap: number };
  runAutopilot(): { queued: number; delivered: number; nudges: number };
  loadSampleData(): Promise<void>;
  /** Permanently removes the account. Returns an error message, or null. */
  deleteAccount(): Promise<string | null>;
  resetAll(): void;
}

const EMPTY: Database = {
  groups: [],
  payments: [],
  transactions: [],
  students: [],
  nudges: [],
  messages: [],
  settings: { ...seedDatabase.settings, teacherName: "" },
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const mode: StoreMode = isSupabaseConfigured ? "cloud" : "local";

  const [db, setDb] = useState<Database>(mode === "cloud" ? EMPTY : seedDatabase);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // Held in a ref so callbacks never capture a stale database.
  const dbRef = useRef<Database>(db);
  dbRef.current = db;

  const cloud = useMemo(
    () => (mode === "cloud" && userId ? new SupabaseStore(userId) : null),
    [mode, userId],
  );

  /* ------------------------------------------------------------- loading */

  const reload = useCallback(async () => {
    if (cloud) {
      const next = await cloud.load();
      setDb(next);
      dbRef.current = next;
    } else if (mode === "local") {
      const next = localStore.read();
      setDb(next);
      dbRef.current = next;
    }
  }, [cloud, mode]);

  // Local mode needs no session.
  useEffect(() => {
    if (mode !== "local") return;
    void reload().then(() => setReady(true));
  }, [mode, reload]);

  // Cloud mode follows the auth session.
  useEffect(() => {
    if (mode !== "cloud") return;
    const client = supabase();

    client.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? null);
      if (!data.session) setReady(true);
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      if (!session) {
        setDb(EMPTY);
        setReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [mode]);

  useEffect(() => {
    if (!cloud) return;
    setReady(false);
    void reload().then(() => setReady(true));
  }, [cloud, reload]);

  /* ------------------------------------------------------------ realtime */

  useEffect(() => {
    if (!cloud || !userId) return;
    const client = supabase();
    const channel = client
      .channel(`labbay:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nudges" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        () => void reload(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [cloud, userId, reload]);

  /* ------------------------------------------------------------- writing */

  // Each write goes to whichever store is active, then refreshes.
  const write = useCallback(
    (cloudOp: () => Promise<unknown>, localOp: () => void) => {
      if (cloud) void cloudOp().then(() => reload());
      else {
        localOp();
        void reload();
      }
    },
    [cloud, reload],
  );

  /**
   * The message list is computed here so the caller gets its answer at once;
   * the database write follows behind.
   */
  const sendNow = useCallback(
    (spec: SendSpec) => {
      const now = new Date();
      const current = dbRef.current;
      const { messages, skippedByCap } = buildMessages(spec, current, now);

      if (cloud) {
        void cloud
          .addMessages(messages)
          .then(() => cloud.load())
          .then((fresh) => cloud.flushDue(now, fresh))
          .then(() => reload());
      } else {
        localStore.addMessages(messages);
        localStore.flushDue(now);
        void reload();
      }
      return { queued: messages.length, skippedByCap };
    },
    [cloud, reload],
  );

  const runAutopilot = useCallback(() => {
    const now = new Date();
    const current = dbRef.current;
    let queued = 0;
    let fired = 0;

    const batches: Array<{ nudgeId: string; messages: Array<Omit<Message, "id">> }> =
      [];

    if (current.settings.autopilot) {
      for (const nudge of dueNudges(current, now)) {
        const { messages } = buildMessages(specFromNudge(nudge), current, now);
        batches.push({ nudgeId: nudge.id, messages });
        queued += messages.length;
        fired++;
      }
    }

    // Delivered count is what was already ripe before this run.
    const delivered = current.settings.telegramConnected
      ? current.messages.filter(
          (m) =>
            m.status === "queued" &&
            new Date(m.scheduledAt).getTime() <= now.getTime(),
        ).length
      : 0;

    if (cloud) {
      void (async () => {
        for (const b of batches) {
          await cloud.addMessages(b.messages);
          await cloud.markNudgeRun(b.nudgeId, now.toISOString());
        }
        if (current.settings.autopilot) {
          await cloud.updateSettings({ lastAutoRunAt: now.toISOString() });
        }
        const fresh = await cloud.load();
        const sent = await cloud.flushDue(now, fresh);
        if (batches.length || sent) await reload();
      })();
    } else {
      for (const b of batches) {
        localStore.addMessages(b.messages);
        localStore.markNudgeRun(b.nudgeId, now.toISOString());
      }
      if (current.settings.autopilot) {
        localStore.updateSettings({ lastAutoRunAt: now.toISOString() });
      }
      const sent = localStore.flushDue(now);
      if (batches.length || sent) void reload();
    }

    return { queued, delivered, nudges: fired };
  }, [cloud, reload]);

  // The engine ticks while the app is open. A Vercel Cron job takes this over
  // once the Telegram worker exists.
  useEffect(() => {
    if (!ready) return;
    if (mode === "cloud" && !userId) return;
    runAutopilot();
    const id = window.setInterval(runAutopilot, 20_000);
    return () => window.clearInterval(id);
  }, [ready, mode, userId, runAutopilot]);

  /* ---------------------------------------------------------------- auth */

  const signUp = useCallback(
    async (name: string, emailAddress: string, password: string) => {
      const { error } = await supabase().auth.signUp({
        email: emailAddress,
        password,
        options: { data: { name } },
      });
      return error?.message ?? null;
    },
    [],
  );

  const signIn = useCallback(async (emailAddress: string, password: string) => {
    const { error } = await supabase().auth.signInWithPassword({
      email: emailAddress,
      password,
    });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    setDb(EMPTY);
  }, []);

  /* --------------------------------------------------------------- value */

  const value = useMemo<StoreValue>(
    () => ({
      db,
      ready,
      mode,
      signedIn: mode === "local" ? true : Boolean(userId),
      email,
      signUp,
      signIn,
      signOut,
      addGroup: (g) =>
        write(
          () => cloud!.addGroup(g),
          () => localStore.addGroup(g),
        ),
      updateGroup: (id, patch) =>
        write(
          () => cloud!.updateGroup(id, patch),
          () => localStore.updateGroup(id, patch),
        ),
      removeGroup: (id) =>
        write(
          () => cloud!.removeGroup(id),
          () => localStore.removeGroup(id),
        ),
      addPayment: (p) =>
        write(
          () => cloud!.addPayment(p),
          () => localStore.addPayment(p),
        ),
      addTransaction: (t) =>
        write(
          () => cloud!.addTransaction(t),
          () => localStore.addTransaction(t),
        ),
      removeTransaction: (id) =>
        write(
          () => cloud!.removeTransaction(id),
          () => localStore.removeTransaction(id),
        ),
      removePayment: (id) =>
        write(
          () => cloud!.removePayment(id),
          () => localStore.removePayment(id),
        ),
      addStudent: (s) =>
        write(
          () => cloud!.addStudent(s),
          () => localStore.addStudent(s),
        ),
      updateStudent: (id, patch) =>
        write(
          () => cloud!.updateStudent(id, patch),
          () => localStore.updateStudent(id, patch),
        ),
      removeStudent: (id) =>
        write(
          () => cloud!.removeStudent(id),
          () => localStore.removeStudent(id),
        ),
      addNudge: (n) =>
        write(
          () => cloud!.addNudge(n),
          () => localStore.addNudge(n),
        ),
      updateNudge: (id, patch) =>
        write(
          () => cloud!.updateNudge(id, patch),
          () => localStore.updateNudge(id, patch),
        ),
      removeNudge: (id) =>
        write(
          () => cloud!.removeNudge(id),
          () => localStore.removeNudge(id),
        ),
      updateMessage: (id, patch) =>
        write(
          () => cloud!.updateMessage(id, patch),
          () => localStore.updateMessage(id, patch),
        ),
      updateSettings: (patch) =>
        write(
          () => cloud!.updateSettings(patch),
          () => localStore.updateSettings(patch),
        ),
      sendNow,
      runAutopilot,
      loadSampleData: async () => {
        if (cloud) await cloud.loadSampleData();
        await reload();
      },
      deleteAccount: async () => {
        if (!cloud) return "Deleting an account needs a Supabase project.";
        const problem = await cloud.deleteAccount();
        if (problem) return problem;
        await supabase().auth.signOut();
        setDb(EMPTY);
        return null;
      },
      resetAll: () =>
        write(
          () => cloud!.clearAll(),
          () => localStore.reset(),
        ),
    }),
    [
      db,
      ready,
      mode,
      userId,
      email,
      cloud,
      write,
      sendNow,
      runAutopilot,
      reload,
      signUp,
      signIn,
      signOut,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
