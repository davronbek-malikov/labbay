import { seedDatabase } from "@/lib/seed";
import type {
  Database,
  Group,
  Message,
  Nudge,
  Payment,
  Settings,
  Student,
} from "@/lib/types";
import { newId, type Repository } from "./repository";

const KEY = "labbay.db.v1";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Keeps everything in the browser for now. Swapped for a Supabase-backed
 * implementation of the same interface once there are real accounts.
 */
export class LocalStore implements Repository {
  read(): Database {
    if (typeof window === "undefined") return clone(seedDatabase);
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const fresh = clone(seedDatabase);
      this.write(fresh);
      return fresh;
    }
    try {
      return JSON.parse(raw) as Database;
    } catch {
      const fresh = clone(seedDatabase);
      this.write(fresh);
      return fresh;
    }
  }

  write(db: Database): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, JSON.stringify(db));
  }

  addGroup(group: Omit<Group, "id" | "createdAt">): Group {
    const db = this.read();
    const created: Group = {
      ...group,
      id: newId("gr"),
      createdAt: new Date().toISOString(),
    };
    db.groups.unshift(created);
    this.write(db);
    return created;
  }

  updateGroup(id: string, patch: Partial<Group>): void {
    const db = this.read();
    db.groups = db.groups.map((g) => (g.id === id ? { ...g, ...patch } : g));
    this.write(db);
  }

  /** Students on a removed course are kept, but lose their course. */
  removeGroup(id: string): void {
    const db = this.read();
    db.groups = db.groups.filter((g) => g.id !== id);
    db.students = db.students.map((s) =>
      s.groupId === id ? { ...s, groupId: null } : s,
    );
    this.write(db);
  }

  addPayment(payment: Omit<Payment, "id" | "createdAt">): Payment {
    const db = this.read();
    const created: Payment = {
      ...payment,
      id: newId("pay"),
      createdAt: new Date().toISOString(),
    };
    db.payments.unshift(created);
    this.write(db);
    return created;
  }

  removePayment(id: string): void {
    const db = this.read();
    db.payments = db.payments.filter((p) => p.id !== id);
    this.write(db);
  }

  addStudent(
    student: Omit<Student, "id" | "createdAt" | "lastContactedAt">,
  ): Student {
    const db = this.read();
    const created: Student = {
      ...student,
      id: newId("st"),
      createdAt: new Date().toISOString(),
      lastContactedAt: null,
    };
    db.students.unshift(created);
    this.write(db);
    return created;
  }

  updateStudent(id: string, patch: Partial<Student>): void {
    const db = this.read();
    db.students = db.students.map((s) => (s.id === id ? { ...s, ...patch } : s));
    this.write(db);
  }

  removeStudent(id: string): void {
    const db = this.read();
    db.students = db.students.filter((s) => s.id !== id);
    db.messages = db.messages.filter((m) => m.studentId !== id);
    db.payments = db.payments.filter((p) => p.studentId !== id);
    this.write(db);
  }

  addNudge(nudge: Omit<Nudge, "id" | "createdAt">): Nudge {
    const db = this.read();
    const created: Nudge = {
      ...nudge,
      id: newId("nd"),
      createdAt: new Date().toISOString(),
    };
    db.nudges.unshift(created);
    this.write(db);
    return created;
  }

  updateNudge(id: string, patch: Partial<Nudge>): void {
    const db = this.read();
    db.nudges = db.nudges.map((n) => (n.id === id ? { ...n, ...patch } : n));
    this.write(db);
  }

  removeNudge(id: string): void {
    const db = this.read();
    db.nudges = db.nudges.filter((n) => n.id !== id);
    this.write(db);
  }

  addMessage(message: Omit<Message, "id">): Message {
    const db = this.read();
    const created: Message = { ...message, id: newId("msg") };
    db.messages.unshift(created);
    this.write(db);
    return created;
  }

  addMessages(messages: Array<Omit<Message, "id">>): number {
    if (messages.length === 0) return 0;
    const db = this.read();
    for (const m of messages) {
      db.messages.unshift({ ...m, id: newId("msg") });
    }
    this.write(db);
    return messages.length;
  }

  markNudgeRun(id: string, at: string): void {
    this.updateNudge(id, { lastRunAt: at });
  }

  flushDue(now: Date): number {
    const db = this.read();
    // Nothing leaves the app until an account is actually connected.
    if (db.settings.deliveryMode !== "simulate") return 0;
    if (!db.settings.telegramConnected) return 0;

    const touched = new Set<string>();
    let delivered = 0;

    db.messages = db.messages.map((m) => {
      if (m.status !== "queued") return m;
      if (new Date(m.scheduledAt).getTime() > now.getTime()) return m;
      delivered++;
      touched.add(m.studentId);
      return { ...m, status: "sent" as const, sentAt: now.toISOString() };
    });

    if (delivered > 0) {
      db.students = db.students.map((s) =>
        touched.has(s.id) ? { ...s, lastContactedAt: now.toISOString() } : s,
      );
      this.write(db);
    }
    return delivered;
  }

  updateMessage(id: string, patch: Partial<Message>): void {
    const db = this.read();
    db.messages = db.messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
    this.write(db);
  }

  updateSettings(patch: Partial<Settings>): void {
    const db = this.read();
    db.settings = { ...db.settings, ...patch };
    this.write(db);
  }

  reset(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEY);
  }
}

export const localStore = new LocalStore();
