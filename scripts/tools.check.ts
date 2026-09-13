/**
 * Exercises the assistant's tool layer against a real database shape.
 *
 * These are the calls the model makes on the teacher's behalf, so a mistake
 * here silently corrupts their students, courses, or money. Everything is run
 * against a clone of the seed data with fake store actions recorded.
 */
import { seedDatabase } from "../src/lib/seed";
import { executeTool, type ToolDeps } from "../src/lib/assistant/execute";
import { examAlerts, payStanding } from "../src/lib/format";
import { findSimilar, similarity, SIMILAR_ENOUGH } from "../src/lib/similar";
import type {
  Database,
  Group,
  Level,
  Payment,
  Student,
  Transaction,
} from "../src/lib/types";

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


/* --------------------------------------------------------------- syllabus */

console.log("\n7. Syllabus and student fields");

const sylDb = clone(seedDatabase);
const course = sylDb.groups[0];

const emptySyl = run(sylDb, "get_syllabus", { course: course.name });
check("get_syllabus works on an empty plan", !emptySyl.out.isError, emptySyl.out.result);

const setSyl = run(sylDb, "set_syllabus", {
  course: course.name,
  levels: [
    {
      name: "A1",
      lessons: [
        { title: "Lesson 1", topics: ["Greetings", "To be"], homework: ["Unit 1"] },
        { title: "Lesson 2", topics: ["Numbers"], homework: [] },
      ],
    },
    { name: "A2", lessons: [{ title: "Lesson 1", topics: ["Past simple"] }] },
  ],
});
check("set_syllabus succeeds", !setSyl.out.isError, setSyl.out.result);
check("set_syllabus counts levels", setSyl.data.levels === 2);
check("set_syllabus counts lessons", setSyl.data.lessons === 3);

const written = (setSyl.calls["updateGroup"] ?? [])[0] as [string, { syllabus: Level[] }];
const levels = written[1].syllabus;
check("every level gets an id", levels.every((l) => Boolean(l.id)));
check("every lesson gets an id", levels.every((l) => l.lessons.every((x) => Boolean(x.id))));
check("topics survive", levels[0].lessons[0].topics.length === 2);
check("a missing homework list becomes empty, not undefined", Array.isArray(levels[0].lessons[1].homework));

// Ids must be stable across an edit, or students pointing at a level break.
const keepDb = clone(sylDb);
keepDb.groups[0].syllabus = levels;
const again = run(keepDb, "set_syllabus", {
  course: course.name,
  levels: [{ name: "A1", lessons: [{ title: "Lesson 1", topics: ["Changed"] }] }],
});
const rewritten = ((again.calls["updateGroup"] ?? [])[0] as [string, { syllabus: Level[] }])[1].syllabus;
check("a kept level keeps its id", rewritten[0].id === levels[0].id);
check("a kept lesson keeps its id", rewritten[0].lessons[0].id === levels[0].lessons[0].id);

const badSyl = run(sylDb, "set_syllabus", { course: course.name, levels: "nope" });
check("set_syllabus rejects a non-list", badSyl.out.isError);

const ghostSyl = run(sylDb, "get_syllabus", { course: "Nothing" });
check("get_syllabus refuses an unknown course", ghostSyl.out.isError);

/* ---------------------------------------------------------- student fields */

const fieldsDb = clone(seedDatabase);
const someone = fieldsDb.students[0];

const setF = run(fieldsDb, "set_student_fields", {
  name: someone.name,
  fields: { School: "Lyceum 3", "Target band": "7.0" },
});
check("set_student_fields succeeds", !setF.out.isError, setF.out.result);
const savedFields = ((setF.calls["updateStudent"] ?? [])[0] as [string, { fields: Record<string, string> }])[1].fields;
check("both fields are stored", savedFields.School === "Lyceum 3" && savedFields["Target band"] === "7.0");

const withExisting = clone(fieldsDb);
withExisting.students[0].fields = { School: "Old", Keep: "yes" };
const merged = run(withExisting, "set_student_fields", {
  name: someone.name,
  fields: { School: "New" },
});
const mergedFields = ((merged.calls["updateStudent"] ?? [])[0] as [string, { fields: Record<string, string> }])[1].fields;
check("an untouched field is kept", mergedFields.Keep === "yes");
check("a named field is replaced", mergedFields.School === "New");

const cleared = run(withExisting, "set_student_fields", {
  name: someone.name,
  fields: { Keep: "" },
});
const clearedFields = ((cleared.calls["updateStudent"] ?? [])[0] as [string, { fields: Record<string, string> }])[1].fields;
check("an empty value removes the field", !("Keep" in clearedFields));

const badF = run(fieldsDb, "set_student_fields", { name: someone.name, fields: "nope" });
check("set_student_fields rejects a non-object", badF.out.isError);


/* ------------------------------------------------------------- duplicates */

console.log("\n8. Duplicate detection");

check("identical names match", similarity("IELTS evening", "IELTS evening") === 1);
check("case and punctuation ignored", similarity("IELTS evening", "ielts-evening") >= SIMILAR_ENOUGH);
check("word order ignored", similarity("IELTS evening", "Evening IELTS") >= SIMILAR_ENOUGH);
check("a typo still matches", similarity("IELTS evening", "IELTS evning") >= SIMILAR_ENOUGH);
check("unrelated names do not match", similarity("IELTS evening", "DTM maths") < SIMILAR_ENOUGH);

// Numbers are usually what distinguishes one course from the next.
check("Grade 10 and Grade 11 are different", similarity("Maths grade 10", "Maths grade 11") < SIMILAR_ENOUGH);
check("Model Building 2 and 3 are different", similarity("Model Building 2", "Model Building 3") < SIMILAR_ENOUGH);

const dupDb = clone(seedDatabase);
const existingCourse = dupDb.groups[0].name;

const dupCourse = run(dupDb, "create_course", { name: existingCourse + " " });
check("create_course refuses an exact duplicate", dupCourse.out.isError);

const nearCourse = run(dupDb, "create_course", { name: existingCourse.toUpperCase() });
check("create_course refuses a near duplicate", nearCourse.out.isError, nearCourse.out.result);

const forced = run(dupDb, "create_course", {
  name: existingCourse.toUpperCase(),
  allow_duplicate: true,
});
check("create_course allows it once confirmed", !forced.out.isError, forced.out.result);
check("the confirmed course is written", (forced.calls["addGroup"] ?? []).length === 1);

const freshCourse = run(dupDb, "create_course", { name: "Chemistry Saturday" });
check("an unrelated course is created without fuss", !freshCourse.out.isError);

const existingStudent = dupDb.students[0].name;
const dupStudent = run(dupDb, "add_student", { name: existingStudent });
check("add_student refuses a duplicate name", dupStudent.out.isError);

const forcedStudent = run(dupDb, "add_student", {
  name: existingStudent,
  allow_duplicate: true,
});
check("add_student allows it once confirmed", !forcedStudent.out.isError);

const findsIt = findSimilar(existingCourse, dupDb.groups);
check("findSimilar locates the existing course", findsIt.length === 1 && findsIt[0].exact);

const skipsSelf = findSimilar(existingCourse, dupDb.groups, { skipId: dupDb.groups[0].id });
check("renaming does not warn about itself", skipsSelf.length === 0);


/* ----------------------------------------------------------- one student */

console.log("\n9. Student profile and payment standing");

const profDb = clone(seedDatabase);
const target = profDb.students[0];
const targetCourse = profDb.groups.find((g) => g.id === target.groupId);

const prof = run(profDb, "get_student", { name: target.name });
check("get_student succeeds", !prof.out.isError, prof.out.result);
check("it returns the name", prof.data.name === target.name);
check("it returns the current course", Boolean(prof.data.current_course));
check("it returns a payment list", Array.isArray(prof.data.payments));
check("it returns fee standing", Boolean(prof.data.fees));

const firstName = target.name.split(" ")[0];
const byFirstName = run(profDb, "get_student", { name: firstName });
check("a first name is enough", !byFirstName.out.isError, byFirstName.out.result);

const noSuch = run(profDb, "get_student", { name: "Nobody At All" });
check("get_student refuses an unknown name", noSuch.out.isError);

// payStanding is what drives the paid/unpaid badge.
const paidUp = clone(seedDatabase);
const p0 = paidUp.students[0];
const c0 = paidUp.groups.find((g) => g.id === p0.groupId)!;
paidUp.payments = [
  {
    id: "pay_full",
    studentId: p0.id,
    amount: c0.fee,
    currency: c0.currency,
    paidAt: new Date().toISOString().slice(0, 10),
    note: "",
    createdAt: new Date().toISOString(),
  },
];
check("paying the fee reads as paid", payStanding(p0, paidUp).state === "paid");

const nothing = clone(seedDatabase);
nothing.payments = [];
check("no payment reads as unpaid", payStanding(nothing.students[0], nothing).state === "unpaid");

const halfway = clone(nothing);
halfway.payments = [
  {
    id: "pay_half",
    studentId: p0.id,
    amount: Math.floor(c0.fee / 2),
    currency: c0.currency,
    paidAt: new Date().toISOString().slice(0, 10),
    note: "",
    createdAt: new Date().toISOString(),
  },
];
check("a part payment reads as part", payStanding(p0, halfway).state === "part");

const noCourse = clone(nothing);
noCourse.students[0] = { ...noCourse.students[0], groupId: null };
check(
  "a student with no course is not called unpaid",
  payStanding(noCourse.students[0], noCourse).state === "none",
);

/* -------------------------------------------------------------- payments */

console.log("\n10. Paying by voice, and who still owes");

const payDb = clone(seedDatabase);
const owesStudent = payDb.students.find((s) => {
  if (!s.groupId) return false;
  return payStanding(s, payDb).state === "unpaid";
});
if (!owesStudent) throw new Error("seed data needs at least one unpaid student for this check");
const owesCourse = payDb.groups.find((g) => g.id === owesStudent.groupId)!;

const paidNoAmount = run(payDb, "record_payment", { student_name: owesStudent.name });
check(
  "\"<name> is paid\" with no amount succeeds",
  !paidNoAmount.out.isError,
  paidNoAmount.out.result,
);
const fullPaymentCall = (paidNoAmount.calls["addPayment"] ?? [])[0] as
  | [{ amount: number; currency: string }]
  | undefined;
check(
  "it pays exactly what was owed",
  fullPaymentCall?.[0].amount === owesCourse.fee,
  `got ${fullPaymentCall?.[0].amount}, expected ${owesCourse.fee}`,
);

const alreadyPaidDb = clone(payDb);
alreadyPaidDb.payments.push({
  id: "pay_settle_up",
  studentId: owesStudent.id,
  amount: owesCourse.fee,
  currency: owesCourse.currency,
  paidAt: new Date().toISOString().slice(0, 10),
  note: "",
  createdAt: new Date().toISOString(),
});
const nothingOwed = run(alreadyPaidDb, "record_payment", { student_name: owesStudent.name });
check(
  "recording 'paid' again with nothing owed asks for an amount instead of double-charging",
  nothingOwed.out.isError,
);

const noCourseStudent = clone(seedDatabase);
noCourseStudent.students[0] = { ...noCourseStudent.students[0], groupId: null };
const offCourse = run(noCourseStudent, "record_payment", {
  student_name: noCourseStudent.students[0].name,
});
check("with no course to infer a fee from, it asks for an amount", offCourse.out.isError);

const explicitAmount = run(payDb, "record_payment", {
  student_name: owesStudent.name,
  amount: 50000,
});
check("an explicit amount is still respected", !explicitAmount.out.isError);
const explicitCall = (explicitAmount.calls["addPayment"] ?? [])[0] as
  | [{ amount: number }]
  | undefined;
check("...and used as given, not the outstanding balance", explicitCall?.[0].amount === 50000);

const owing = run(payDb, "list_students", { payment: "owing" });
check("list_students(payment: owing) succeeds", !owing.out.isError, owing.out.result);
const owingNames = (owing.data.students as Array<{ name: string; payment_status: string }>).map(
  (s) => s.name,
);
check("it includes an unpaid student", owingNames.includes(owesStudent.name));
check(
  "every listed student is actually unpaid or part-paid",
  (owing.data.students as Array<{ payment_status: string }>).every(
    (s) => s.payment_status === "unpaid" || s.payment_status === "part",
  ),
);

const paidOnly = run(payDb, "list_students", { payment: "paid" });
check(
  "list_students(payment: paid) excludes the unpaid student",
  !(paidOnly.data.students as Array<{ name: string }>).some((s) => s.name === owesStudent.name),
);

/* ------------------------------------------------------------------ done */





const payments: Payment[] = db.payments;
const txs: Transaction[] = db.transactions;
console.log(
  `\nseed: ${db.students.length} students, ${db.groups.length} courses, ` +
    `${payments.length} payments, ${txs.length} transactions`,
);
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
