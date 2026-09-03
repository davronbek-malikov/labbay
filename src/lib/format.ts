import type {
  Audience,
  Database,
  Currency,
  Group,
  Payment,
  Student,
  Transaction,
} from "@/lib/types";

export function time(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  return `${shortDate(iso)} · ${time(d.getHours(), d.getMinutes())}`;
}

/** "14 Mar 2026", or a dash when the date has not been set. */
export function longDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Days from today until a date. Negative once it has passed. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** "today" / "yesterday" / "9 days ago" / "never". */
export function since(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** Monday-first index for a date, matching the week strip. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/* --------------------------------------------------------------- money */

export const CURRENCIES: Array<{ value: Currency; label: string; short: string }> = [
  { value: "UZS", label: "So'm (UZS)", short: "so'm" },
  { value: "USD", label: "US dollar (USD)", short: "$" },
  { value: "KRW", label: "Korean won (KRW)", short: "₩" },
];

/** Grouped so large numbers stay readable, with the symbol where it belongs. */
export function money(amount: number, currency: Currency = "UZS"): string {
  const n = Math.round(amount);
  if (currency === "USD") return `$${n.toLocaleString("en-US")}`;
  if (currency === "KRW") return `₩${n.toLocaleString("en-US")}`;
  return `${n.toLocaleString("en-US").replace(/,/g, " ")} so'm`;
}

/** Totals for one currency. Mixing currencies in one number is meaningless. */
export interface MoneyTotals {
  income: number;
  expense: number;
  net: number;
  feeIncome: number;
}

/**
 * What came in and what went out over a window, split by currency.
 *
 * Student fees live in `payments` and everything else in `transactions`, so
 * both are counted. A payment has no currency of its own — it inherits the
 * course's — so the course has to be looked up to know what unit it is in.
 */
export function financeSummary(
  db: Pick<Database, "payments" | "transactions" | "students" | "groups">,
  sinceDays = 30,
): {
  byCurrency: Partial<Record<Currency, MoneyTotals>>;
  /** The currency most of the money is in, for a single headline figure. */
  primary: Currency;
  /** True when more than one currency is in play, so a single total would lie. */
  mixed: boolean;
} {
  const cutoff = new Date(Date.now() - sinceDays * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const byCurrency: Partial<Record<Currency, MoneyTotals>> = {};
  const bucket = (c: Currency): MoneyTotals =>
    (byCurrency[c] ??= { income: 0, expense: 0, net: 0, feeIncome: 0 });

  const currencyOfStudent = (studentId: string): Currency => {
    const student = db.students.find((s) => s.id === studentId);
    const group = db.groups.find((g) => g.id === student?.groupId);
    return group?.currency ?? "UZS";
  };

  for (const p of db.payments) {
    if (p.paidAt < cutoff) continue;
    const b = bucket(currencyOfStudent(p.studentId));
    b.feeIncome += p.amount;
    b.income += p.amount;
  }

  for (const t of db.transactions) {
    if (t.occurredAt < cutoff) continue;
    const b = bucket(t.currency);
    if (t.kind === "income") b.income += t.amount;
    else b.expense += t.amount;
  }

  for (const c of Object.keys(byCurrency) as Currency[]) {
    const b = byCurrency[c]!;
    b.net = b.income - b.expense;
  }

  const entries = Object.entries(byCurrency) as Array<[Currency, MoneyTotals]>;
  const primary =
    entries.sort(
      (a, b) => b[1].income + b[1].expense - (a[1].income + a[1].expense),
    )[0]?.[0] ?? "UZS";

  return { byCurrency, primary, mixed: entries.length > 1 };
}

export function paymentsOf(studentId: string, payments: Payment[]): Payment[] {
  return payments
    .filter((p) => p.studentId === studentId)
    .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
}

export function totalPaid(studentId: string, payments: Payment[]): number {
  return paymentsOf(studentId, payments).reduce((sum, p) => sum + p.amount, 0);
}

/* -------------------------------------------------------------- courses */

export function groupOf(
  student: Student,
  groups: Group[],
): Group | undefined {
  return groups.find((g) => g.id === student.groupId);
}

export function groupNameOf(student: Student, groups: Group[]): string {
  return groupOf(student, groups)?.name ?? "No course";
}

export function studentsIn(groupId: string, students: Student[]): Student[] {
  return students.filter((s) => s.groupId === groupId);
}

/* ------------------------------------------------------------ audiences */

export function audienceOf(audience: Audience, students: Student[]): Student[] {
  const active = students.filter((s) => s.status === "active");
  if (audience.kind === "all") return active;
  if (audience.kind === "group")
    return active.filter((s) => s.groupId === audience.groupId);
  return students.filter((s) => audience.studentIds.includes(s.id));
}

export function audienceLabel(
  audience: Audience,
  students: Student[],
  groups: Group[],
): string {
  if (audience.kind === "all") return "All active students";
  if (audience.kind === "group")
    return groups.find((g) => g.id === audience.groupId)?.name ?? "Removed course";
  const n = audience.studentIds.length;
  return `${n} student${n === 1 ? "" : "s"}`;
}
