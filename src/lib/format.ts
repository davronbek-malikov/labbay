import type { Audience, Currency, Group, Payment, Student } from "@/lib/types";

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
