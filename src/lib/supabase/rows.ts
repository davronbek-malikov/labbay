import type {
  Audience,
  Currency,
  Transaction,
  TransactionKind,
  DeliveryMode,
  Group,
  GroupKind,
  Language,
  Payment,
  Message,
  MessageStatus,
  Nudge,
  Settings,
  Student,
  StudentStatus,
  Tone,
} from "@/lib/types";

/**
 * Database rows use snake_case and `group_name` (because `group` is reserved
 * in SQL). These translate both ways so the rest of the app never sees it.
 */

export interface GroupRow {
  id: string;
  teacher_id: string;
  name: string;
  kind: GroupKind;
  start_date: string | null;
  end_date: string | null;
  final_exam_date: string | null;
  fee: number;
  currency: Currency;
  exam_ack_date: string | null;
  topics: string[] | null;
  homework: string[] | null;
  notes: string | null;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  teacher_id: string;
  student_id: string;
  amount: number;
  paid_at: string;
  note: string;
  created_at: string;
}

export interface StudentRow {
  id: string;
  teacher_id: string;
  name: string;
  telegram: string;
  subject: string;
  group_id: string | null;
  level: string;
  ai_notes: string;
  status: StudentStatus;
  last_contacted_at: string | null;
  created_at: string;
}

export interface NudgeRow {
  id: string;
  teacher_id: string;
  name: string;
  audience: Audience;
  days: number[];
  hour: number;
  minute: number;
  intent: string;
  tone: Tone;
  channel: "text" | "voice";
  personalize: boolean;
  status: "active" | "paused";
  last_run_at: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  teacher_id: string;
  student_id: string;
  nudge_id: string | null;
  text: string;
  status: MessageStatus;
  channel: "text" | "voice";
  scheduled_at: string;
  sent_at: string | null;
  error: string | null;
}

export interface SettingsRow {
  teacher_id: string;
  telegram_phone: string;
  telegram_connected: boolean;
  delay_min_seconds: number;
  delay_max_seconds: number;
  daily_cap: number;
  quiet_hours_start: number;
  quiet_hours_end: number;
  default_tone: Tone;
  language: Language;
  autopilot: boolean;
  last_auto_run_at: string | null;
  delivery_mode: DeliveryMode;
  worker_seen_at: string | null;
}

export const toStudent = (r: StudentRow): Student => ({
  id: r.id,
  name: r.name,
  telegram: r.telegram,
  subject: r.subject,
  groupId: r.group_id,
  level: r.level,
  aiNotes: r.ai_notes,
  status: r.status,
  lastContactedAt: r.last_contacted_at,
  createdAt: r.created_at,
});

export function fromStudent(
  p: Partial<Student>,
): Partial<Omit<StudentRow, "id" | "teacher_id" | "created_at">> {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.telegram !== undefined) row.telegram = p.telegram;
  if (p.subject !== undefined) row.subject = p.subject;
  if (p.groupId !== undefined) row.group_id = p.groupId;
  if (p.level !== undefined) row.level = p.level;
  if (p.aiNotes !== undefined) row.ai_notes = p.aiNotes;
  if (p.status !== undefined) row.status = p.status;
  if (p.lastContactedAt !== undefined) row.last_contacted_at = p.lastContactedAt;
  return row;
}

export const toGroup = (r: GroupRow): Group => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  startDate: r.start_date,
  endDate: r.end_date,
  finalExamDate: r.final_exam_date,
  fee: Number(r.fee),
  currency: r.currency ?? "UZS",
  examAckDate: r.exam_ack_date ?? null,
  topics: r.topics ?? [],
  homework: r.homework ?? [],
  notes: r.notes ?? "",
  createdAt: r.created_at,
});

export function fromGroup(
  p: Partial<Group>,
): Partial<Omit<GroupRow, "id" | "teacher_id" | "created_at">> {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.kind !== undefined) row.kind = p.kind;
  if (p.startDate !== undefined) row.start_date = p.startDate;
  if (p.endDate !== undefined) row.end_date = p.endDate;
  if (p.finalExamDate !== undefined) row.final_exam_date = p.finalExamDate;
  if (p.fee !== undefined) row.fee = p.fee;
  if (p.currency !== undefined) row.currency = p.currency;
  if (p.examAckDate !== undefined) row.exam_ack_date = p.examAckDate;
  if (p.topics !== undefined) row.topics = p.topics;
  if (p.homework !== undefined) row.homework = p.homework;
  if (p.notes !== undefined) row.notes = p.notes;
  return row;
}

export const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  studentId: r.student_id,
  amount: Number(r.amount),
  paidAt: r.paid_at,
  note: r.note ?? "",
  createdAt: r.created_at,
});

export function fromPayment(
  p: Partial<Payment>,
): Partial<Omit<PaymentRow, "id" | "teacher_id" | "created_at">> {
  const row: Record<string, unknown> = {};
  if (p.studentId !== undefined) row.student_id = p.studentId;
  if (p.amount !== undefined) row.amount = p.amount;
  if (p.paidAt !== undefined) row.paid_at = p.paidAt;
  if (p.note !== undefined) row.note = p.note;
  return row;
}

export interface TransactionRow {
  id: string;
  teacher_id: string;
  kind: TransactionKind;
  amount: number;
  currency: Currency;
  category: string;
  note: string;
  occurred_at: string;
  created_at: string;
}

export const toTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  kind: r.kind,
  amount: Number(r.amount),
  currency: r.currency ?? "UZS",
  category: r.category ?? "",
  note: r.note ?? "",
  occurredAt: r.occurred_at,
  createdAt: r.created_at,
});

export function fromTransaction(
  p: Partial<Transaction>,
): Partial<Omit<TransactionRow, "id" | "teacher_id" | "created_at">> {
  const row: Record<string, unknown> = {};
  if (p.kind !== undefined) row.kind = p.kind;
  if (p.amount !== undefined) row.amount = p.amount;
  if (p.currency !== undefined) row.currency = p.currency;
  if (p.category !== undefined) row.category = p.category;
  if (p.note !== undefined) row.note = p.note;
  if (p.occurredAt !== undefined) row.occurred_at = p.occurredAt;
  return row;
}

export const toNudge = (r: NudgeRow): Nudge => ({
  id: r.id,
  name: r.name,
  audience: r.audience,
  days: r.days ?? [],
  hour: r.hour,
  minute: r.minute,
  intent: r.intent,
  tone: r.tone,
  channel: r.channel,
  personalize: r.personalize,
  status: r.status,
  lastRunAt: r.last_run_at,
  createdAt: r.created_at,
});

export function fromNudge(
  p: Partial<Nudge>,
): Partial<Omit<NudgeRow, "id" | "teacher_id" | "created_at">> {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.audience !== undefined) row.audience = p.audience;
  if (p.days !== undefined) row.days = p.days;
  if (p.hour !== undefined) row.hour = p.hour;
  if (p.minute !== undefined) row.minute = p.minute;
  if (p.intent !== undefined) row.intent = p.intent;
  if (p.tone !== undefined) row.tone = p.tone;
  if (p.channel !== undefined) row.channel = p.channel;
  if (p.personalize !== undefined) row.personalize = p.personalize;
  if (p.status !== undefined) row.status = p.status;
  if (p.lastRunAt !== undefined) row.last_run_at = p.lastRunAt;
  return row;
}

export const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  studentId: r.student_id,
  nudgeId: r.nudge_id,
  text: r.text,
  status: r.status,
  channel: r.channel,
  scheduledAt: r.scheduled_at,
  sentAt: r.sent_at,
  ...(r.error ? { error: r.error } : {}),
});

export function fromMessage(
  p: Partial<Message>,
): Partial<Omit<MessageRow, "id" | "teacher_id">> {
  const row: Record<string, unknown> = {};
  if (p.studentId !== undefined) row.student_id = p.studentId;
  if (p.nudgeId !== undefined) row.nudge_id = p.nudgeId;
  if (p.text !== undefined) row.text = p.text;
  if (p.status !== undefined) row.status = p.status;
  if (p.channel !== undefined) row.channel = p.channel;
  if (p.scheduledAt !== undefined) row.scheduled_at = p.scheduledAt;
  if (p.sentAt !== undefined) row.sent_at = p.sentAt;
  if ("error" in p) row.error = p.error ?? null;
  return row;
}

export const toSettings = (r: SettingsRow, teacherName: string): Settings => ({
  teacherName,
  telegramPhone: r.telegram_phone,
  telegramConnected: r.telegram_connected,
  delayMinSeconds: r.delay_min_seconds,
  delayMaxSeconds: r.delay_max_seconds,
  dailyCap: r.daily_cap,
  quietHoursStart: r.quiet_hours_start,
  quietHoursEnd: r.quiet_hours_end,
  defaultTone: r.default_tone,
  language: r.language,
  autopilot: r.autopilot,
  lastAutoRunAt: r.last_auto_run_at,
  deliveryMode: r.delivery_mode ?? "simulate",
  workerSeenAt: r.worker_seen_at ?? null,
});

/** `teacherName` lives on the profile, so it is filtered out here. */
export function fromSettings(
  p: Partial<Settings>,
): Partial<Omit<SettingsRow, "teacher_id">> {
  const row: Record<string, unknown> = {};
  if (p.telegramPhone !== undefined) row.telegram_phone = p.telegramPhone;
  if (p.telegramConnected !== undefined) row.telegram_connected = p.telegramConnected;
  if (p.delayMinSeconds !== undefined) row.delay_min_seconds = p.delayMinSeconds;
  if (p.delayMaxSeconds !== undefined) row.delay_max_seconds = p.delayMaxSeconds;
  if (p.dailyCap !== undefined) row.daily_cap = p.dailyCap;
  if (p.quietHoursStart !== undefined) row.quiet_hours_start = p.quietHoursStart;
  if (p.quietHoursEnd !== undefined) row.quiet_hours_end = p.quietHoursEnd;
  if (p.defaultTone !== undefined) row.default_tone = p.defaultTone;
  if (p.language !== undefined) row.language = p.language;
  if (p.autopilot !== undefined) row.autopilot = p.autopilot;
  if (p.lastAutoRunAt !== undefined) row.last_auto_run_at = p.lastAutoRunAt;
  if (p.deliveryMode !== undefined) row.delivery_mode = p.deliveryMode;
  return row;
}
