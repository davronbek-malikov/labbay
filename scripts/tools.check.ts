/**
 * Exercises the assistant's tool layer against a real database shape.
 *
 * These are the calls the model makes on the teacher's behalf, so a mistake
 * here silently corrupts their students, courses, or money. Everything is run
 * against a clone of the seed data with fake store actions recorded.
 */
import { seedDatabase } from "../src/lib/seed";
import { executeTool, type ToolDeps } from "../src/lib/assistant/execute";
import { examAlerts } from "../src/lib/format";
import type { Database, Group, Payment, Student, Transaction } from "../src/lib/types";

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

/** A ToolDeps that records what was asked of it instead of touching a store. */
function harness(db: Database) {
  const calls: Record<string, unknown[]> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      (calls[name] ??= []).push(args);
    };

  const deps: ToolDeps = {
    db,
    navigate: record("navigate") as ToolDeps["navigate"],
    sendNow: ((spec: unknown) => {
      (calls["sendNow"] ??= []).push([spec]);
      return { queued: 1, skippedByCap: 0 };
    }) as ToolDeps["sendNow"],
    addNudge: record("addNudge") as ToolDeps["addNudge"],
    updateNudge: record("updateNudge") as ToolDeps["updateNudge"],
    removeNudge: record("removeNudge") as ToolDeps["removeNudge"],
    updateStudent: record("updateStudent") as ToolDeps["updateStudent"],
    addStudent: record("addStudent") as ToolDeps["addStudent"],
    removeStudent: record("removeStudent") as ToolDeps["removeStudent"],
    addGroup: record("addGroup") as ToolDeps["addGroup"],
    updateGroup: record("updateGroup") as ToolDeps["updateGroup"],
    removeGroup: record("removeGroup") as ToolDeps["removeGroup"],
    addPayment: record("addPayment") as ToolDeps["addPayment"],
    addTransaction: record("addTransaction") as ToolDeps["addTransaction"],
    removeTransaction: record("removeTransaction") as ToolDeps["removeTransaction"],
    updateSettings: record("updateSettings") as ToolDeps["updateSettings"],
  };
  return { deps, calls };
}

const run = (db: Database, name: string, input: Record<string, unknown> = {}) => {
  const { deps, calls } = harness(db);
  const out = executeTool(name, input, deps);
  return { out, calls, data: JSON.parse(out.result) as Record<string, unknown> };
};

/* ------------------------------------------------------------------ reads */

console.log("\n1. Reads never error on seed data");
const db = clone(seedDatabase);
for (const tool of [
  "get_overview",
  "list_students",
  "list_courses",
  "list_nudges",
  "list_messages",
  "get_money",
  "list_transactions",
]) {
  const { out } = run(db, tool);
  check(`${tool} succeeds`, !out.isError, out.result.slice(0, 90));
}

/* ------------------------------------------------------------------ money */

console.log("\n2. Money");

const m = run(db, "get_money", { days: 3650 });
const currencies = m.data.currencies as Array<Record<string, string>>;
check("get_money splits by currency", Array.isArray(currencies) && currencies.length > 0);

const seedExpense = db.transactions
  .filter((t) => t.kind === "expense" && t.currency === "UZS")
  .reduce((s, t) => s + t.amount, 0);
const uzs = currencies.find((c) => c.currency === "UZS");
check(
  "UZS expenses match the seed data",
  String(uzs?.expenses ?? "").replace(/\D/g, "") === String(Math.round(seedExpense)),
  `got ${uzs?.expenses}, expected ${seedExpense}`,
);

// A second currency must never be folded into the first.
const mixedDb = clone(seedDatabase);
mixedDb.transactions.push({
  id: "tx_won",
  kind: "expense",
  amount: 50000,
  currency: "KRW",
  category: "Won test",
  note: "",
  occurredAt: new Date().toISOString().slice(0, 10),
  createdAt: new Date().toISOString(),
});
const mixed = run(mixedDb, "get_money", { days: 3650 });
const mixedList = mixed.data.currencies as Array<Record<string, string>>;
check("a second currency gets its own row", mixedList.length >= 2);
check("mixed currencies are flagged", mixed.data.mixed_currencies === true);
const krw = mixedList.find((c) => c.currency === "KRW");
check(
  "the won total is not blended into so'm",
  String(krw?.expenses ?? "").replace(/\D/g, "") === "50000",
  `got ${krw?.expenses}`,
);

const added = run(db, "add_transaction", {
  kind: "expense",
  amount: 250000,
  category: "Printing",
  note: "Worksheets",
});
check("add_transaction succeeds", !added.out.isError);
check("add_transaction reaches the store", (added.calls["addTransaction"] ?? []).length === 1);
check("add_transaction reports what it did", Boolean(added.out.sideEffect));

const bad = run(db, "add_transaction", { kind: "profit", amount: 10 });
check("add_transaction rejects a bad kind", bad.out.isError);

const negative = run(db, "add_transaction", { kind: "expense", amount: -5 });
check("add_transaction rejects a negative amount", negative.out.isError);

const zero = run(db, "add_transaction", { kind: "income", amount: 0 });
check("add_transaction rejects zero", zero.out.isError);

const deleted = run(db, "delete_transaction", { category: "Rent" });
check("delete_transaction finds by category", !deleted.out.isError, deleted.out.result);
check(
  "delete_transaction reaches the store",
  (deleted.calls["removeTransaction"] ?? []).length === 1,
);

const missing = run(db, "delete_transaction", { category: "Yacht" });
check("delete_transaction refuses an unknown category", missing.out.isError);

/* --------------------------------------------------------------- students */

console.log("\n3. Students and courses");

const firstStudent = db.students[0] as Student;
const upd = run(db, "update_student", {
  name: firstStudent.name,
  ai_notes: "Prefers short messages.",
});
check("update_student matches a real name", !upd.out.isError, upd.out.result);
check("update_student writes", (upd.calls["updateStudent"] ?? []).length === 1);

const ghost = run(db, "update_student", { name: "Nobody Here" });
check("update_student refuses an unknown name", ghost.out.isError);

const addS = run(db, "add_student", { name: "Test Person", telegram: "@test_person" });
check("add_student succeeds", !addS.out.isError, addS.out.result);
check("add_student writes", (addS.calls["addStudent"] ?? []).length === 1);

const firstCourse = db.groups[0] as Group;
const courseUpd = run(db, "update_course", {
  name: firstCourse.name,
  topics: ["Tenses", "Essay structure"],
});
check("update_course matches a real course", !courseUpd.out.isError, courseUpd.out.result);
check("update_course writes", (courseUpd.calls["updateGroup"] ?? []).length === 1);

/* -------------------------------------------------------------- integrity */

console.log("\n4. Reads do not mutate");
const before = JSON.stringify(db);
run(db, "get_overview");
run(db, "list_students");
run(db, "get_money");
check("database untouched by reads", JSON.stringify(db) === before);

console.log("\n5. Unknown tool");
const unknown = run(db, "make_coffee");
check("unknown tool fails cleanly", unknown.out.isError);


/* ------------------------------------------------------------------ exams */

console.log("\n6. Exam alerts");

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const examDb = clone(seedDatabase);
examDb.groups[0].finalExamDate = inDays(5);
examDb.groups[0].examAckDate = null;
for (const g of examDb.groups.slice(1)) g.finalExamDate = null;

check("an exam 5 days away raises an alert", examAlerts(examDb).length === 1);

const ackedDb = clone(examDb);
ackedDb.groups[0].examAckDate = ackedDb.groups[0].finalExamDate;
check("acknowledging it clears the alert", examAlerts(ackedDb).length === 0);

// Moving the exam must raise it again, or a rescheduled exam goes unnoticed.
const movedDb = clone(ackedDb);
movedDb.groups[0].finalExamDate = inDays(9);
check("moving the exam raises it again", examAlerts(movedDb).length === 1);

const farDb = clone(examDb);
farDb.groups[0].finalExamDate = inDays(60);
check("a distant exam stays quiet", examAlerts(farDb).length === 0);

const pastDb = clone(examDb);
pastDb.groups[0].finalExamDate = inDays(-3);
check("a finished exam stays quiet", examAlerts(pastDb).length === 0);

const todayDb = clone(examDb);
todayDb.groups[0].finalExamDate = today();
check("an exam today still alerts", examAlerts(todayDb).length === 1);
check("an exam today reads as 0 days", examAlerts(todayDb)[0].daysAway === 0);

const noDate = clone(examDb);
noDate.groups[0].finalExamDate = null;
check("a course with no exam never alerts", examAlerts(noDate).length === 0);

const listed = run(examDb, "list_exams");
check("list_exams sees it", (listed.data.count as number) === 1, listed.out.result);

const ackTool = run(examDb, "acknowledge_exam", { course: examDb.groups[0].name });
check("acknowledge_exam succeeds", !ackTool.out.isError, ackTool.out.result);
check(
  "acknowledge_exam writes the date",
  (ackTool.calls["updateGroup"] ?? []).length === 1,
);

const ackGhost = run(examDb, "acknowledge_exam", { course: "No Such Course" });
check("acknowledge_exam refuses an unknown course", ackGhost.out.isError);

/* ------------------------------------------------------------------ done */


const payments: Payment[] = db.payments;
const txs: Transaction[] = db.transactions;
console.log(
  `\nseed: ${db.students.length} students, ${db.groups.length} courses, ` +
    `${payments.length} payments, ${txs.length} transactions`,
);
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
