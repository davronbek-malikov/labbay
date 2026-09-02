import type {
  Database,
  Group,
  Message,
  Nudge,
  Payment,
  Settings,
  Student,
} from "@/lib/types";

/**
 * Everything the UI is allowed to do to the data.
 *
 * The localStorage implementation backs the app today; a Supabase
 * implementation drops in behind this same interface later without the
 * screens changing.
 */
export interface Repository {
  read(): Database;
  write(db: Database): void;

  addGroup(group: Omit<Group, "id" | "createdAt">): Group;
  updateGroup(id: string, patch: Partial<Group>): void;
  removeGroup(id: string): void;

  addPayment(payment: Omit<Payment, "id" | "createdAt">): Payment;
  removePayment(id: string): void;

  addStudent(student: Omit<Student, "id" | "createdAt" | "lastContactedAt">): Student;
  updateStudent(id: string, patch: Partial<Student>): void;
  removeStudent(id: string): void;

  addNudge(nudge: Omit<Nudge, "id" | "createdAt">): Nudge;
  updateNudge(id: string, patch: Partial<Nudge>): void;
  removeNudge(id: string): void;

  addMessage(message: Omit<Message, "id">): Message;
  addMessages(messages: Array<Omit<Message, "id">>): number;
  updateMessage(id: string, patch: Partial<Message>): void;
  /** Records that autopilot fired a nudge, so it will not fire again today. */
  markNudgeRun(id: string, at: string): void;
  /** Marks queued messages whose time has come as sent. Returns how many. */
  flushDue(now: Date): number;

  updateSettings(patch: Partial<Settings>): void;
  reset(): void;
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
