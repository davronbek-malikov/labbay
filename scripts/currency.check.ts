/**
 * Payments carry their own currency, and won must never be added to so'm.
 *
 * A course is priced in one currency but a student may hand over another, so
 * the two have to be kept apart or "what is still owed" becomes a number that
 * means nothing.
 */
import { seedDatabase } from "../src/lib/seed";
import { executeTool, type ToolDeps } from "../src/lib/assistant/execute";
import { financeSummary, payStanding } from "../src/lib/format";
import type { Database } from "../src/lib/types";

const clone = (d: Database): Database => JSON.parse(JSON.stringify(d));

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name} ${extra}`);
  }
};

function harness(db: Database) {
  const calls: Record<string, unknown[]> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      (calls[name] ??= []).push(args);
    };
  const deps = {
    db,
    navigate: record("navigate"),
    sendNow: () => ({ queued: 1, skippedByCap: 0 }),
    addNudge: record("addNudge"),
    updateNudge: record("updateNudge"),
    removeNudge: record("removeNudge"),
    updateStudent: record("updateStudent"),
    addStudent: record("addStudent"),
    removeStudent: record("removeStudent"),
    addGroup: record("addGroup"),
    updateGroup: record("updateGroup"),
    removeGroup: record("removeGroup"),
    addPayment: record("addPayment"),
    addTransaction: record("addTransaction"),
    removeTransaction: record("removeTransaction"),
    updateSettings: record("updateSettings"),
  } as unknown as ToolDeps;
  return { deps, calls };
}

const run = (db: Database, name: string, input: Record<string, unknown> = {}) => {
  const { deps, calls } = harness(db);
  const out = executeTool(name, input, deps);
  return { out, calls, data: JSON.parse(out.result) as Record<string, unknown> };
};

console.log("\nPayment currency");

/* --------------------------------- a won payment against a so'm course --- */

const curDb = clone(seedDatabase);
const cs = curDb.students[0];
const cc = curDb.groups.find((g) => g.id === cs.groupId)!;
cc.currency = "UZS";
cc.fee = 1_000_000;

curDb.payments = [
  {
    id: "p_uzs",
    studentId: cs.id,
    amount: 400_000,
    currency: "UZS",
    paidAt: "2026-01-10",
    note: "",
    createdAt: "2026-01-10",
  },
  {
    id: "p_krw",
    studentId: cs.id,
    amount: 50_000,
    currency: "KRW",
    paidAt: "2026-01-11",
    note: "",
    createdAt: "2026-01-11",
  },
];

const st = payStanding(cs, curDb);
check("only same-currency payments count towards the fee", st.paid === 400_000, `got ${st.paid}`);
check("the shortfall is right", st.owed === 600_000, `got ${st.owed}`);
check("it reads as a part payment", st.state === "part");
check(
  "the won payment is kept separate",
  st.alsoPaid.length === 1 && st.alsoPaid[0].currency === "KRW",
);
check("the won amount is intact", st.alsoPaid[0]?.amount === 50_000);
check("the badge is in so'm", st.label.includes("so'm"), st.label);

/* ----------------------------------------------- a course priced in won --- */

const wonDb = clone(seedDatabase);
const ws = wonDb.students[0];
const wc = wonDb.groups.find((g) => g.id === ws.groupId)!;
wc.currency = "KRW";
wc.fee = 500_000;
wonDb.payments = [
  {
    id: "p_w",
    studentId: ws.id,
    amount: 500_000,
    currency: "KRW",
    paidAt: "2026-02-01",
    note: "",
    createdAt: "2026-02-01",
  },
];

const wst = payStanding(ws, wonDb);
check("a won course reads in won", wst.currency === "KRW");
check("paying it in won reads as paid", wst.state === "paid");
check("the badge never says so'm", !wst.label.includes("so'm"), wst.label);

/* --------------------------------------------------- through the assistant */

const recKrw = run(curDb, "record_payment", {
  student_name: cs.name,
  amount: 30_000,
  currency: "KRW",
});
check("record_payment takes a currency", !recKrw.out.isError, recKrw.out.result);

const recorded = (recKrw.calls["addPayment"] ?? [])[0] as [{ currency: string }];
check(
  "the currency reaches the store",
  recorded?.[0]?.currency === "KRW",
  JSON.stringify(recorded?.[0]),
);
check(
  "it is reported back in won",
  String(recKrw.data.amount).includes("₩"),
  String(recKrw.data.amount),
);

const recDefault = run(wonDb, "record_payment", { student_name: ws.name, amount: 1000 });
const defaulted = (recDefault.calls["addPayment"] ?? [])[0] as [{ currency: string }];
check("with none given it follows the course", defaulted?.[0]?.currency === "KRW");

const prof = run(curDb, "get_student", { name: cs.name });
const fees = prof.data.fees as Record<string, unknown>;
check(
  "get_student surfaces other-currency payments",
  Array.isArray(fees.also_paid_in_other_currencies) &&
    (fees.also_paid_in_other_currencies as string[]).length === 1,
);

/* ------------------------------------------------------ the money summary */

const sum = financeSummary(curDb, 36_500);
check("the summary keeps so'm and won apart", Boolean(sum.byCurrency.UZS && sum.byCurrency.KRW));
check("mixed currencies are flagged", sum.mixed === true);
check(
  "won income is not folded into so'm",
  sum.byCurrency.KRW?.income === 50_000,
  String(sum.byCurrency.KRW?.income),
);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
