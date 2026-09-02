import { seedDatabase } from "../src/lib/seed";
import { buildMessages, dueNudges, specFromNudge, isQuietHour } from "../src/lib/engine/send";
import type { Database } from "../src/lib/types";

const clone = (d: Database): Database => JSON.parse(JSON.stringify(d));
let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

console.log("\n1. Quiet hours (22:00 -> 08:00)");
const db0 = clone(seedDatabase);
check("23:00 is quiet", isQuietHour(23, db0.settings));
check("03:00 is quiet", isQuietHour(3, db0.settings));
check("19:00 is not quiet", !isQuietHour(19, db0.settings));

console.log("\n2. dueNudges picks only what is actually due");
const db1 = clone(seedDatabase);
// Force a nudge to be due: Monday 10:00, nudge on Monday at 09:00.
const monday = new Date("2026-09-07T10:00:00");
db1.nudges = [{ ...db1.nudges[1], days: [0], hour: 9, minute: 0, status: "active", lastRunAt: null }];
check("due nudge is returned", dueNudges(db1, monday).length === 1);

const beforeTime = new Date("2026-09-07T08:00:00");
check("not due before its time", dueNudges(db1, beforeTime).length === 0);

const db2 = clone(db1);
db2.nudges[0].lastRunAt = new Date("2026-09-07T09:05:00").toISOString();
check("does not fire twice in a day", dueNudges(db2, monday).length === 0);

const db3 = clone(db1);
db3.nudges[0].status = "paused";
check("paused nudge never fires", dueNudges(db3, monday).length === 0);

const quietNow = new Date("2026-09-07T23:00:00");
check("quiet hours hold everything", dueNudges(db1, quietNow).length === 0);

console.log("\n3. buildMessages");
const db4 = clone(seedDatabase);
db4.messages = [];
const spec = specFromNudge(db4.nudges[0]);
const built = buildMessages(spec, db4, monday);
const activeCount = db4.students.filter(s => s.status === "active").length;
check(`one message per active student (${built.messages.length}/${activeCount})`,
  built.messages.length === activeCount);
check("paused students excluded",
  !built.messages.some(m => db4.students.find(s => s.id === m.studentId)!.status === "paused"));
check("all start queued", built.messages.every(m => m.status === "queued"));
check("texts differ per student",
  new Set(built.messages.map(m => m.text)).size > 1,
  `only ${new Set(built.messages.map(m => m.text)).size} unique`);
check("sends are spread out in time",
  new Date(built.messages[built.messages.length - 1].scheduledAt).getTime() >
  new Date(built.messages[0].scheduledAt).getTime());

console.log("\n4. Daily cap");
const db5 = clone(seedDatabase);
db5.messages = [];
db5.settings.dailyCap = 5;
const capped = buildMessages(spec, db5, monday);
check("cap limits the batch", capped.messages.length === 5, `got ${capped.messages.length}`);
check("overflow is reported", capped.skippedByCap === activeCount - 5);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
