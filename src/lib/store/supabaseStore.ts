import { supabase } from "@/lib/supabase/client";
import {
  fromGroup,
  fromTransaction,
  fromMessage,
  fromPayment,
  fromNudge,
  fromSettings,
  fromStudent,
  toGroup,
  toMessage,
  toTransaction,
  toNudge,
  toPayment,
  toSettings,
  toStudent,
  type GroupRow,
  type MessageRow,
  type TransactionRow,
  type NudgeRow,
  type PaymentRow,
  type SettingsRow,
  type StudentRow,
} from "@/lib/supabase/rows";
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

/**
 * Turns a Supabase result into an exception.
 *
 * Every write used to ignore its `error`, so a rejected insert — a missing
 * column, a policy refusal — looked exactly like success and the teacher was
 * left staring at a form that did nothing.
 */
function must<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

/**
 * The real store. Everything is scoped to the signed-in teacher by row level
 * security, so no query here has to filter by teacher — the database does it.
 */
export class SupabaseStore {
  constructor(private readonly teacherId: string) {}

  async load(): Promise<Database> {
    const db = supabase();

    const [
      profile,
      groups,
      payments,
      transactions,
      students,
      nudges,
      messages,
      settings,
    ] =
      await Promise.all([
      db.from("profiles").select("name").eq("id", this.teacherId).maybeSingle(),
      db.from("groups").select("*").order("created_at", { ascending: false }),
      db.from("payments").select("*").order("paid_at", { ascending: false }),
      db
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false }),
      db.from("students").select("*").order("created_at", { ascending: false }),
      db.from("nudges").select("*").order("created_at", { ascending: false }),
      db
        .from("messages")
        .select("*")
        .order("scheduled_at", { ascending: false })
        .limit(500),
      db
        .from("settings")
        .select("*")
        .eq("teacher_id", this.teacherId)
        .maybeSingle(),
      ]);

    const name = (profile.data as { name?: string } | null)?.name ?? "";

    // The signup trigger creates these, but a hand-made account might not
    // have them yet.
    let settingsRow = settings.data as SettingsRow | null;
    if (!settingsRow) {
      const created = await db
        .from("settings")
        .insert({ teacher_id: this.teacherId })
        .select("*")
        .single();
      settingsRow = created.data as SettingsRow;
    }

    return {
      groups: ((groups.data ?? []) as GroupRow[]).map(toGroup),
      payments: ((payments.data ?? []) as PaymentRow[]).map(toPayment),
      transactions: ((transactions.data ?? []) as TransactionRow[]).map(
        toTransaction,
      ),
      students: ((students.data ?? []) as StudentRow[]).map(toStudent),
      nudges: ((nudges.data ?? []) as NudgeRow[]).map(toNudge),
      messages: ((messages.data ?? []) as MessageRow[]).map(toMessage),
      settings: toSettings(settingsRow, name),
    };
  }

  async setTeacherName(name: string): Promise<void> {
    must(await supabase()
      .from("profiles")
      .upsert({ id: this.teacherId, name })
      .eq("id", this.teacherId));
  }

  async addGroup(group: Omit<Group, "id" | "createdAt">): Promise<string | null> {
    const { data } = must(await supabase()
      .from("groups")
      .insert({ ...fromGroup(group), teacher_id: this.teacherId })
      .select("id")
      .single());
    return (data as { id: string } | null)?.id ?? null;
  }

  async updateGroup(id: string, patch: Partial<Group>): Promise<void> {
    must(await supabase().from("groups").update(fromGroup(patch)).eq("id", id));
  }

  async removeGroup(id: string): Promise<void> {
    must(await supabase().from("groups").delete().eq("id", id));
  }

  async addTransaction(
    t: Omit<Transaction, "id" | "createdAt">,
  ): Promise<void> {
    must(await supabase()
      .from("transactions")
      .insert({ ...fromTransaction(t), teacher_id: this.teacherId }));
  }

  async removeTransaction(id: string): Promise<void> {
    must(await supabase().from("transactions").delete().eq("id", id));
  }

  async addPayment(
    payment: Omit<Payment, "id" | "createdAt">,
  ): Promise<void> {
    must(await supabase()
      .from("payments")
      .insert({ ...fromPayment(payment), teacher_id: this.teacherId }));
  }

  async removePayment(id: string): Promise<void> {
    must(await supabase().from("payments").delete().eq("id", id));
  }

  async addStudent(
    student: Omit<Student, "id" | "createdAt" | "lastContactedAt">,
  ): Promise<void> {
    must(await supabase()
      .from("students")
      .insert({ ...fromStudent(student), teacher_id: this.teacherId }));
  }

  async updateStudent(id: string, patch: Partial<Student>): Promise<void> {
    must(await supabase().from("students").update(fromStudent(patch)).eq("id", id));
  }

  async removeStudent(id: string): Promise<void> {
    must(await supabase().from("students").delete().eq("id", id));
  }

  async addNudge(nudge: Omit<Nudge, "id" | "createdAt">): Promise<void> {
    must(await supabase()
      .from("nudges")
      .insert({ ...fromNudge(nudge), teacher_id: this.teacherId }));
  }

  async updateNudge(id: string, patch: Partial<Nudge>): Promise<void> {
    must(await supabase().from("nudges").update(fromNudge(patch)).eq("id", id));
  }

  async removeNudge(id: string): Promise<void> {
    must(await supabase().from("nudges").delete().eq("id", id));
  }

  async addMessages(messages: Array<Omit<Message, "id">>): Promise<number> {
    if (messages.length === 0) return 0;
    must(await supabase()
      .from("messages")
      .insert(
        messages.map((m) => ({ ...fromMessage(m), teacher_id: this.teacherId })),
      ));
    return messages.length;
  }

  async updateMessage(id: string, patch: Partial<Message>): Promise<void> {
    must(await supabase().from("messages").update(fromMessage(patch)).eq("id", id));
  }

  async markNudgeRun(id: string, at: string): Promise<void> {
    must(await supabase().from("nudges").update({ last_run_at: at }).eq("id", id));
  }

  /**
   * Marks queued messages whose time has come as sent, and records that their
   * students have now heard from the teacher.
   */
  async flushDue(now: Date, db: Database): Promise<number> {
    // In worker mode the worker is the only thing allowed to mark a message
    // sent, so the app must not touch it.
    if (db.settings.deliveryMode !== "simulate") return 0;
    if (!db.settings.telegramConnected) return 0;

    const ready = db.messages.filter(
      (m) =>
        m.status === "queued" &&
        new Date(m.scheduledAt).getTime() <= now.getTime(),
    );
    if (ready.length === 0) return 0;

    const stamp = now.toISOString();
    const client = supabase();

    await client
      .from("messages")
      .update({ status: "sent", sent_at: stamp })
      .in(
        "id",
        ready.map((m) => m.id),
      );

    const studentIds = Array.from(new Set(ready.map((m) => m.studentId)));
    await client
      .from("students")
      .update({ last_contacted_at: stamp })
      .in("id", studentIds);

    return ready.length;
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    if (patch.teacherName !== undefined) {
      await this.setTeacherName(patch.teacherName);
    }
    const row = fromSettings(patch);
    if (Object.keys(row).length === 0) return;
    must(await supabase()
      .from("settings")
      .update(row)
      .eq("teacher_id", this.teacherId));
  }

  /** Removes the account and everything attached to it, permanently. */
  async deleteAccount(): Promise<string | null> {
    const { error } = await supabase().rpc("delete_own_account");
    return error?.message ?? null;
  }

  /** Wipes this teacher's data. Their account and settings stay. */
  async clearAll(): Promise<void> {
    const client = supabase();
    await client.from("messages").delete().eq("teacher_id", this.teacherId);
    await client.from("payments").delete().eq("teacher_id", this.teacherId);
    await client.from("transactions").delete().eq("teacher_id", this.teacherId);
    await client.from("nudges").delete().eq("teacher_id", this.teacherId);
    await client.from("students").delete().eq("teacher_id", this.teacherId);
    await client.from("groups").delete().eq("teacher_id", this.teacherId);
  }

  /** Fills a fresh account with the sample class, so it is not empty. */
  async loadSampleData(): Promise<void> {
    const { seedDatabase } = await import("@/lib/seed");
    const client = supabase();

    const groups = await client
      .from("groups")
      .insert(
        seedDatabase.groups.map((g) => ({
          ...fromGroup(g),
          teacher_id: this.teacherId,
        })),
      )
      .select("id, name");

    const groupIdByName = new Map(
      ((groups.data ?? []) as Array<{ id: string; name: string }>).map((r) => [
        r.name,
        r.id,
      ]),
    );
    const seedGroupName = new Map(
      seedDatabase.groups.map((g) => [g.id, g.name] as const),
    );
    const realGroupId = (seedId: string | null) =>
      seedId ? (groupIdByName.get(seedGroupName.get(seedId) ?? "") ?? null) : null;

    const students = await client
      .from("students")
      .insert(
        seedDatabase.students.map((s) => ({
          ...fromStudent({ ...s, groupId: realGroupId(s.groupId) }),
          teacher_id: this.teacherId,
        })),
      )
      .select("id, name");

    const idByName = new Map(
      ((students.data ?? []) as Array<{ id: string; name: string }>).map((r) => [
        r.name,
        r.id,
      ]),
    );
    const nameById = new Map(
      seedDatabase.students.map((s) => [s.id, s.name] as const),
    );
    const realId = (seedId: string) => idByName.get(nameById.get(seedId) ?? "");

    const paymentRows = seedDatabase.payments.flatMap((p) => {
      const studentId = realId(p.studentId);
      if (!studentId) return [];
      return [{ ...fromPayment({ ...p, studentId }), teacher_id: this.teacherId }];
    });
    if (paymentRows.length) await client.from("payments").insert(paymentRows);

    await client.from("nudges").insert(
      seedDatabase.nudges.map((n) => {
        const audience =
          n.audience.kind === "picked"
            ? {
                kind: "picked" as const,
                studentIds: n.audience.studentIds
                  .map(realId)
                  .filter((v): v is string => Boolean(v)),
              }
            : n.audience.kind === "group"
              ? {
                  kind: "group" as const,
                  groupId: realGroupId(n.audience.groupId) ?? "",
                }
              : n.audience;
        return { ...fromNudge({ ...n, audience }), teacher_id: this.teacherId };
      }),
    );
  }
}
