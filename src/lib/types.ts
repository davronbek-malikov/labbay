export type StudentStatus = "active" | "paused";

/** A group teaches many students; an individual course teaches exactly one. */
export type GroupKind = "group" | "individual";

/** What a course is priced in. */
export type Currency = "UZS" | "USD" | "KRW";

/** Who actually delivers a message: the app pretending, or the real worker. */
export type DeliveryMode = "simulate" | "worker";

export type Tone = "warm" | "direct" | "playful" | "formal";

export type Language = "uz" | "ru" | "en";

/** One lesson: what it covers and what it sets. */
export interface Lesson {
  id: string;
  title: string;
  topics: string[];
  homework: string[];
}

/**
 * A stage of a course. Teachers name these differently — "A1", "Beginner",
 * "Unit 3", "Term 1" — so the name is free text and can be changed any time.
 */
export interface Level {
  id: string;
  name: string;
  lessons: Lesson[];
}

/**
 * A course. Both kinds carry the same facts — what it is called, when it runs,
 * when the final exam is, and what it costs.
 */
export interface Group {
  id: string;
  name: string;
  kind: GroupKind;
  /** ISO date (YYYY-MM-DD), or null when not decided yet. */
  startDate: string | null;
  endDate: string | null;
  finalExamDate: string | null;
  /** What one student pays for the whole course. */
  fee: number;
  currency: Currency;
  /**
   * The exam date the teacher has confirmed seeing. When it differs from
   * `finalExamDate` the alert is shown, so closing it is not the same as
   * dealing with it.
   */
  examAckDate: string | null;
  /** Levels, each holding its lessons. The shape every teacher fills in. */
  syllabus: Level[];
  /** What the course covers. Every teacher shapes this differently. */
  topics: string[];
  /** Homework the class works through. */
  homework: string[];
  /** Anything else worth remembering about the course. */
  notes: string;
  createdAt: string;
}

/** Money in or out that is not a student's course fee. */
export type TransactionKind = "income" | "expense";

export interface Transaction {
  id: string;
  kind: TransactionKind;
  amount: number;
  currency: Currency;
  /** Free text: rent, transport, books, private lesson… */
  category: string;
  note: string;
  /** ISO date (YYYY-MM-DD). */
  occurredAt: string;
  createdAt: string;
}

/** A course a student has finished or moved on from. */
export interface PastCourse {
  groupId: string;
  /** Copied in, so the history survives the course being deleted. */
  name: string;
  from: string | null;
  to: string;
}

/** One payment a student made towards their course fee. */
export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  /** Its own, so a won payment can sit against a so'm course. */
  currency: Currency;
  /** ISO date (YYYY-MM-DD). */
  paidAt: string;
  note: string;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  /** Telegram handle (@name) or phone number in international format. */
  telegram: string;
  subject: string;
  /** The course they are on. Null only while being moved between courses. */
  groupId: string | null;
  level: string;
  /** Which level of the course syllabus they are working through. */
  levelId: string | null;
  /** When they joined their current course. */
  enrolledAt: string | null;
  /** Courses they were on before this one, newest last. */
  pastCourses: PastCourse[];
  /**
   * Anything this teacher wants to track — parent's phone, school, target
   * band. Free-form so a maths tutor and a language tutor can both use it.
   */
  fields: Record<string, string>;
  /** Free-text context the agent conditions on, e.g. "shy, needs gentle tone". */
  aiNotes: string;
  status: StudentStatus;
  /** ISO date of the last message we sent them, or null if never. */
  lastContactedAt: string | null;
  createdAt: string;
}

export type Audience =
  | { kind: "all" }
  | { kind: "group"; groupId: string }
  | { kind: "picked"; studentIds: string[] };

export type Channel = "text" | "voice";

export interface Nudge {
  id: string;
  name: string;
  audience: Audience;
  /** 0 = Monday … 6 = Sunday. */
  days: number[];
  hour: number;
  minute: number;
  /** What the teacher wants to get across, in their own words. */
  intent: string;
  tone: Tone;
  channel: Channel;
  /** When on, each student gets their own wording. When off, everyone gets `intent`. */
  personalize: boolean;
  status: "active" | "paused";
  /** Set when autopilot last fired this nudge, so it cannot double-send. */
  lastRunAt?: string | null;
  createdAt: string;
}

/** `sending` means a worker has claimed it and is talking to Telegram. */
export type MessageStatus = "queued" | "sending" | "sent" | "failed";

export interface Message {
  id: string;
  studentId: string;
  nudgeId: string | null;
  text: string;
  status: MessageStatus;
  channel: Channel;
  scheduledAt: string;
  sentAt: string | null;
  /** Present when status is "failed". */
  error?: string;
}

export interface Settings {
  teacherName: string;
  /** Phone of the Telegram account messages are sent from. */
  telegramPhone: string;
  telegramConnected: boolean;
  /** Seconds waited between two sends, randomised within this range. */
  delayMinSeconds: number;
  delayMaxSeconds: number;
  dailyCap: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  defaultTone: Tone;
  language: Language;
  /** When on, due nudges send themselves while the app is open. */
  autopilot: boolean;
  lastAutoRunAt: string | null;
  deliveryMode: DeliveryMode;
  /** Stamped by the worker each cycle, so the app can show if it is alive. */
  workerSeenAt: string | null;
}

export interface Database {
  groups: Group[];
  payments: Payment[];
  transactions: Transaction[];
  students: Student[];
  nudges: Nudge[];
  messages: Message[];
  settings: Settings;
}
