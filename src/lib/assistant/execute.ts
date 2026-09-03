import {
  audienceOf,
  groupNameOf,
  money,
  paymentsOf,
  since,
  time,
  totalPaid,
} from "@/lib/format";
import { autopilotBlockedReason } from "@/lib/engine/send";
import type { SendSpec } from "@/lib/engine/send";
import type {
  Audience,
  Currency,
  Database,
  Group,
  GroupKind,
  Nudge,
  Payment,
  Student,
  Tone,
} from "@/lib/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** What the chat page hands the executor so tools can act on the app. */
export interface ToolDeps {
  db: Database;
  /** Set by the chat page; the assistant asks, the page does the routing. */
  navigate(screen: string): void;
  sendNow(spec: SendSpec): { queued: number; skippedByCap: number };
  addNudge(n: Omit<Nudge, "id" | "createdAt">): void;
  updateNudge(id: string, patch: Partial<Nudge>): void;
  updateStudent(id: string, patch: Partial<Student>): void;
  addStudent(s: Omit<Student, "id" | "createdAt" | "lastContactedAt">): void;
  removeStudent(id: string): void;
  addGroup(g: Omit<Group, "id" | "createdAt">): void;
  updateGroup(id: string, patch: Partial<Group>): void;
  removeGroup(id: string): void;
  addPayment(p: Omit<Payment, "id" | "createdAt">): void;
  removeNudge(id: string): void;
  updateSettings(patch: Partial<Database["settings"]>): void;
}

type Input = Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

function findStudent(db: Database, name: string): Student | undefined {
  const q = name.trim().toLowerCase();
  return (
    db.students.find((s) => s.name.toLowerCase() === q) ??
    db.students.find((s) => s.name.toLowerCase().includes(q)) ??
    db.students.find((s) => s.name.split(" ")[0].toLowerCase() === q)
  );
}

function findGroup(db: Database, name: string): Group | undefined {
  const q = name.trim().toLowerCase();
  return (
    db.groups.find((g) => g.name.toLowerCase() === q) ??
    db.groups.find((g) => g.name.toLowerCase().includes(q))
  );
}

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Turns "all" / a group name / a list of names into a real audience. */
function resolveAudience(db: Database, raw: string): Audience | { error: string } {
  const value = raw.trim();
  if (!value || value.toLowerCase() === "all" || value.toLowerCase() === "everyone")
    return { kind: "all" };

  const group = db.groups.find(
    (g) => g.name.toLowerCase() === value.toLowerCase(),
  );
  if (group) return { kind: "group", groupId: group.id };

  const names = value.split(",").map((n) => n.trim()).filter(Boolean);
  const ids: string[] = [];
  const missing: string[] = [];
  for (const n of names) {
    const s = findStudent(db, n);
    if (s) ids.push(s.id);
    else missing.push(n);
  }
  if (ids.length === 0)
    return { error: `No student or group matched "${value}".` };
  if (missing.length)
    return { error: `Matched some but not: ${missing.join(", ")}.` };
  return { kind: "picked", studentIds: ids };
}

function describeStudent(s: Student, db: Database): Record<string, unknown> {
  const group = db.groups.find((g) => g.id === s.groupId);
  const paid = totalPaid(s.id, db.payments);
  return {
    name: s.name,
    course: group?.name ?? "none",
    course_kind: group?.kind ?? "none",
    course_ends: group?.endDate ?? null,
    final_exam: group?.finalExamDate ?? null,
    fee: group ? money(group.fee, group.currency) : null,
    paid: money(paid, group?.currency),
    outstanding: group
      ? money(Math.max(0, group.fee - paid), group.currency)
      : null,
    subject: s.subject,
    level: s.level,
    status: s.status,
    notes: s.aiNotes,
    last_heard_from_you: since(s.lastContactedAt),
  };
}

function describeNudge(n: Nudge, db: Database): Record<string, unknown> {
  return {
    name: n.name,
    status: n.status,
    days: n.days.map((d) => DAYS[d]),
    time: time(n.hour, n.minute),
    intent: n.intent,
    tone: n.tone,
    personalized: n.personalize,
    recipients: audienceOf(n.audience, db.students).length,
  };
}

/**
 * Runs one tool call and returns a JSON string for the tool_result block.
 * Never throws — a failure comes back as `{ error }` so the model can recover.
 */
export function executeTool(
  name: string,
  input: Input,
  deps: ToolDeps,
): { result: string; isError: boolean; sideEffect?: string } {
  const { db } = deps;
  const ok = (data: unknown, sideEffect?: string) => ({
    result: JSON.stringify(data),
    isError: false,
    sideEffect,
  });
  const fail = (message: string) => ({
    result: JSON.stringify({ error: message }),
    isError: true,
  });

  switch (name) {
    case "get_overview": {
      const active = db.students.filter((s) => s.status === "active");
      const quiet = active.filter(
        (s) =>
          !s.lastContactedAt ||
          Date.now() - new Date(s.lastContactedAt).getTime() > 7 * 86_400_000,
      );
      return ok({
        students: { active: active.length, paused: db.students.length - active.length },
        courses: db.groups.map((g) => ({
          name: g.name,
          kind: g.kind,
          students: db.students.filter((s) => s.groupId === g.id).length,
          ends: g.endDate,
          final_exam: g.finalExamDate,
        })),
        nudges: {
          active: db.nudges.filter((n) => n.status === "active").length,
          paused: db.nudges.filter((n) => n.status === "paused").length,
        },
        messages: {
          sent: db.messages.filter((m) => m.status === "sent").length,
          queued: db.messages.filter((m) => m.status === "queued").length,
          failed: db.messages.filter((m) => m.status === "failed").length,
        },
        autopilot: db.settings.autopilot ? "on" : "off",
        autopilot_blocked_by: autopilotBlockedReason(db, new Date()),
        telegram_connected: db.settings.telegramConnected,
        daily_cap: db.settings.dailyCap,
        quiet_hours: `${time(db.settings.quietHoursStart, 0)}–${time(db.settings.quietHoursEnd, 0)}`,
        gone_quiet: quiet.map((s) => ({
          name: s.name,
          silent_for: since(s.lastContactedAt),
        })),
      });
    }

    case "list_students": {
      const group = str(input.group);
      const status = str(input.status);
      const quietDays = num(input.quiet_for_days);
      let list = db.students;
      if (group) {
        const match = db.groups.find(
          (g) => g.name.toLowerCase() === group.toLowerCase(),
        );
        list = list.filter((s) => s.groupId === match?.id);
      }
      if (status) list = list.filter((s) => s.status === status);
      if (quietDays !== undefined) {
        list = list.filter(
          (s) =>
            !s.lastContactedAt ||
            Date.now() - new Date(s.lastContactedAt).getTime() >
              quietDays * 86_400_000,
        );
      }
      return ok({
        count: list.length,
        students: list.map((s) => describeStudent(s, db)),
      });
    }

    case "navigate_to": {
      const screen = str(input.screen);
      if (!screen) return fail("screen is required.");
      const known = [
        "dashboard",
        "assistant",
        "courses",
        "students",
        "send",
        "nudges",
        "messages",
        "settings",
      ];
      if (!known.includes(screen)) return fail(`No screen called "${screen}".`);
      deps.navigate(screen);
      return ok(
        { navigated_to: screen },
        `Opened ${screen === "send" ? "Send now" : screen}`,
      );
    }

    case "add_student": {
      const name = str(input.name);
      if (!name) return fail("name is required.");
      if (findStudent(db, name)) return fail(`${name} is already on your list.`);

      let groupId: string | null = null;
      const courseName = str(input.course);
      if (courseName) {
        const course = findGroup(db, courseName);
        if (!course) return fail(`No course called "${courseName}".`);
        groupId = course.id;
      }

      deps.addStudent({
        name,
        telegram: str(input.telegram) ?? "",
        subject: str(input.subject) ?? "",
        level: str(input.level) ?? "",
        aiNotes: str(input.ai_notes) ?? "",
        status: "active",
        groupId,
      });
      return ok({ added: name }, `Added ${name}`);
    }

    case "delete_student": {
      const who = str(input.name);
      if (!who) return fail("name is required.");
      const student = findStudent(db, who);
      if (!student) return fail(`No student called "${who}".`);
      deps.removeStudent(student.id);
      return ok({ deleted: student.name }, `Removed ${student.name}`);
    }

    case "create_course": {
      const name = str(input.name);
      if (!name) return fail("name is required.");
      if (findGroup(db, name)) return fail(`A course called "${name}" exists.`);

      deps.addGroup({
        name,
        kind: (str(input.kind) as GroupKind) ?? "group",
        startDate: str(input.start_date) ?? null,
        endDate: str(input.end_date) ?? null,
        finalExamDate: str(input.final_exam_date) ?? null,
        fee: num(input.fee) ?? 0,
        currency: (str(input.currency) as Currency) ?? "UZS",
        topics: list(input.topics),
        homework: list(input.homework),
        notes: str(input.notes) ?? "",
      });
      return ok({ created: name }, `Created ${name}`);
    }

    case "update_course": {
      const name = str(input.name);
      if (!name) return fail("name is required.");
      const course = findGroup(db, name);
      if (!course) return fail(`No course called "${name}".`);

      const patch: Partial<Group> = {};
      if (str(input.new_name)) patch.name = str(input.new_name)!;
      if (str(input.start_date)) patch.startDate = str(input.start_date)!;
      if (str(input.end_date)) patch.endDate = str(input.end_date)!;
      if (str(input.final_exam_date))
        patch.finalExamDate = str(input.final_exam_date)!;
      if (num(input.fee) !== undefined) patch.fee = num(input.fee)!;
      if (str(input.currency)) patch.currency = str(input.currency) as Currency;
      if ("notes" in input) patch.notes = str(input.notes) ?? "";
      if ("topics" in input) patch.topics = list(input.topics);
      if ("homework" in input) patch.homework = list(input.homework);
      // Appending is the common case, so it gets its own argument.
      if (list(input.add_topics).length)
        patch.topics = [...course.topics, ...list(input.add_topics)];
      if (list(input.add_homework).length)
        patch.homework = [...course.homework, ...list(input.add_homework)];

      if (Object.keys(patch).length === 0) return fail("Nothing to change.");
      deps.updateGroup(course.id, patch);
      return ok({ updated: course.name }, `Updated ${course.name}`);
    }

    case "delete_course": {
      const name = str(input.name);
      if (!name) return fail("name is required.");
      const course = findGroup(db, name);
      if (!course) return fail(`No course called "${name}".`);
      const members = db.students.filter((s) => s.groupId === course.id).length;
      deps.removeGroup(course.id);
      return ok(
        { deleted: course.name, students_left_without_a_course: members },
        `Deleted ${course.name}`,
      );
    }

    case "record_payment": {
      const who = str(input.student_name);
      const amount = num(input.amount);
      if (!who) return fail("student_name is required.");
      if (!amount || amount <= 0) return fail("amount must be a positive number.");
      const student = findStudent(db, who);
      if (!student) return fail(`No student called "${who}".`);

      const paidAt = str(input.paid_at) ?? new Date().toISOString().slice(0, 10);
      deps.addPayment({
        studentId: student.id,
        amount,
        paidAt,
        note: str(input.note) ?? "",
      });
      const course = db.groups.find((g) => g.id === student.groupId);
      return ok(
        {
          student: student.name,
          amount: money(amount, course?.currency),
          paid_at: paidAt,
        },
        `Recorded ${money(amount, course?.currency)} from ${student.name}`,
      );
    }

    case "delete_nudge": {
      const name = str(input.name);
      if (!name) return fail("name is required.");
      const nudge = db.nudges.find(
        (n) => n.name.toLowerCase() === name.toLowerCase(),
      );
      if (!nudge) return fail(`No nudge called "${name}".`);
      deps.removeNudge(nudge.id);
      return ok({ deleted: nudge.name }, `Deleted ${nudge.name}`);
    }

    case "list_courses": {
      return ok({
        courses: db.groups.map((g) => {
          const members = db.students.filter((s) => s.groupId === g.id);
          const collected = members.reduce(
            (sum, s) => sum + totalPaid(s.id, db.payments),
            0,
          );
          return {
            name: g.name,
            kind: g.kind,
            starts: g.startDate,
            ends: g.endDate,
            final_exam: g.finalExamDate,
            fee_each: money(g.fee, g.currency),
            students: members.map((s) => s.name),
            collected: money(collected, g.currency),
            expected: money(g.fee * members.length, g.currency),
            topics: g.topics,
            homework: g.homework,
            notes: g.notes || undefined,
          };
        }),
      });
    }

    case "get_payments": {
      const who = str(input.student_name);
      if (!who) return fail("student_name is required.");
      const student = findStudent(db, who);
      if (!student) return fail(`No student named "${who}".`);

      const course = db.groups.find((g) => g.id === student.groupId);
      const history = paymentsOf(student.id, db.payments);
      const paid = totalPaid(student.id, db.payments);

      return ok({
        student: student.name,
        course: course?.name ?? "none",
        fee: course ? money(course.fee, course.currency) : null,
        paid: money(paid, course?.currency),
        outstanding: course
          ? money(Math.max(0, course.fee - paid), course.currency)
          : null,
        payments: history.map((p) => ({
          amount: money(p.amount, course?.currency),
          when: p.paidAt,
          note: p.note || undefined,
        })),
      });
    }

    case "list_nudges":
      return ok({ nudges: db.nudges.map((n) => describeNudge(n, db)) });

    case "list_messages": {
      const studentName = str(input.student_name);
      const status = str(input.status);
      const limit = Math.min(num(input.limit) ?? 20, 60);
      let list = [...db.messages].sort(
        (a, b) =>
          new Date(b.sentAt ?? b.scheduledAt).getTime() -
          new Date(a.sentAt ?? a.scheduledAt).getTime(),
      );
      if (status) list = list.filter((m) => m.status === status);
      if (studentName) {
        const s = findStudent(db, studentName);
        if (!s) return fail(`No student named "${studentName}".`);
        list = list.filter((m) => m.studentId === s.id);
      }
      return ok({
        count: list.length,
        messages: list.slice(0, limit).map((m) => ({
          to: db.students.find((s) => s.id === m.studentId)?.name ?? "removed",
          text: m.text,
          status: m.status,
          when: m.sentAt ?? m.scheduledAt,
          ...(m.error ? { error: m.error } : {}),
        })),
      });
    }

    case "send_message": {
      const audienceRaw = str(input.audience);
      const intent = str(input.intent);
      if (!audienceRaw) return fail("audience is required.");
      if (!intent) return fail("intent is required.");

      const audience = resolveAudience(db, audienceRaw);
      if ("error" in audience) return fail(audience.error);

      const recipients = audienceOf(audience, db.students).filter(
        (s) => s.status === "active",
      );
      if (recipients.length === 0) return fail("That audience has no active students.");

      const r = deps.sendNow({
        audience,
        intent,
        tone: (str(input.tone) as Tone) ?? db.settings.defaultTone,
        personalize: input.personalize !== false,
        nudgeId: null,
      });

      return ok(
        {
          queued: r.queued,
          skipped_by_daily_cap: r.skippedByCap,
          delivering: db.settings.telegramConnected,
          note: db.settings.telegramConnected
            ? "Messages are going out now, spaced apart."
            : "Telegram is not connected, so these are queued and will not leave the app yet.",
          recipients: recipients.map((s) => s.name),
        },
        `Sent to ${r.queued} student${r.queued === 1 ? "" : "s"}`,
      );
    }

    case "create_nudge": {
      const name = str(input.name);
      const audienceRaw = str(input.audience);
      const intent = str(input.intent);
      const hour = num(input.hour);
      const minute = num(input.minute);
      const days = Array.isArray(input.days)
        ? (input.days.filter((d) => typeof d === "number" && d >= 0 && d <= 6) as number[])
        : [];

      if (!name || !audienceRaw || !intent) return fail("name, audience and intent are required.");
      if (hour === undefined || minute === undefined) return fail("hour and minute are required.");
      if (days.length === 0) return fail("Pick at least one weekday (0 = Monday).");

      const audience = resolveAudience(db, audienceRaw);
      if ("error" in audience) return fail(audience.error);

      deps.addNudge({
        name,
        audience,
        days: [...days].sort(),
        hour,
        minute,
        intent,
        tone: (str(input.tone) as Tone) ?? db.settings.defaultTone,
        channel: "text",
        personalize: true,
        status: "active",
      });

      return ok(
        {
          created: name,
          days: days.map((d) => DAYS[d]),
          time: time(hour, minute),
          recipients: audienceOf(audience, db.students).length,
        },
        `Created nudge "${name}"`,
      );
    }

    case "set_nudge_status": {
      const name = str(input.name);
      const status = str(input.status);
      if (!name || (status !== "active" && status !== "paused"))
        return fail("name and a status of active or paused are required.");
      const nudge =
        db.nudges.find((n) => n.name.toLowerCase() === name.toLowerCase()) ??
        db.nudges.find((n) => n.name.toLowerCase().includes(name.toLowerCase()));
      if (!nudge) return fail(`No nudge named "${name}".`);
      deps.updateNudge(nudge.id, { status });
      return ok({ nudge: nudge.name, status }, `${status === "active" ? "Resumed" : "Paused"} "${nudge.name}"`);
    }

    case "update_student": {
      const name = str(input.name);
      if (!name) return fail("name is required.");
      const student = findStudent(db, name);
      if (!student) return fail(`No student named "${name}".`);

      const patch: Partial<Student> = {};
      if (str(input.ai_notes)) patch.aiNotes = str(input.ai_notes)!;
      if (str(input.group)) {
        const match = db.groups.find(
          (g) => g.name.toLowerCase() === str(input.group)!.toLowerCase(),
        );
        if (!match) return fail(`No course named "${str(input.group)}".`);
        patch.groupId = match.id;
      }
      if (str(input.level)) patch.level = str(input.level)!;
      const status = str(input.status);
      if (status === "active" || status === "paused") patch.status = status;

      if (Object.keys(patch).length === 0) return fail("Nothing to change.");
      deps.updateStudent(student.id, patch);
      return ok(
        { student: student.name, changed: Object.keys(patch) },
        `Updated ${student.name}`,
      );
    }

    case "set_autopilot": {
      if (typeof input.enabled !== "boolean") return fail("enabled must be true or false.");
      deps.updateSettings({ autopilot: input.enabled });
      return ok(
        { autopilot: input.enabled ? "on" : "off" },
        `Autopilot ${input.enabled ? "on" : "off"}`,
      );
    }

    default:
      return fail(`Unknown tool "${name}".`);
  }
}

/** Compact snapshot sent with every request so small talk needs no tool call. */
export function snapshot(db: Database): string {
  const active = db.students.filter((s) => s.status === "active").length;
  const queued = db.messages.filter((m) => m.status === "queued").length;
  return [
    `Teacher: ${db.settings.teacherName}`,
    `Students: ${active} active of ${db.students.length}`,
    `Courses: ${db.groups.map((g) => g.name).join(", ") || "none"}`,
    `Nudges: ${db.nudges.filter((n) => n.status === "active").length} active of ${db.nudges.length}`,
    `Queued messages: ${queued}`,
    `Autopilot: ${db.settings.autopilot ? "on" : "off"}${
      autopilotBlockedReason(db, new Date())
        ? ` (held: ${autopilotBlockedReason(db, new Date())})`
        : ""
    }`,
    `Telegram connected: ${db.settings.telegramConnected ? "yes" : "no"}`,
    `Today: ${new Date().toLocaleDateString(undefined, { weekday: "long" })}, ${time(new Date().getHours(), new Date().getMinutes())}`,
  ].join("\n");
}
