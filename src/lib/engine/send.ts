import { personalize, plain } from "@/lib/ai/personalize";
import { audienceOf, weekdayIndex } from "@/lib/format";
import type {
  Audience,
  Database,
  Message,
  Nudge,
  Settings,
  Student,
  Tone,
} from "@/lib/types";

/** Everything needed to turn one instruction into per-student messages. */
export interface SendSpec {
  audience: Audience;
  intent: string;
  tone: Tone;
  personalize: boolean;
  nudgeId: string | null;
}

export function isQuietHour(hour: number, settings: Settings): boolean {
  const { quietHoursStart: start, quietHoursEnd: end } = settings;
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

export function composeFor(
  student: Student,
  spec: SendSpec,
  settings: Settings,
): string {
  return spec.personalize
    ? personalize({
        student,
        intent: spec.intent,
        tone: spec.tone,
        language: settings.language,
      })
    : plain(spec.intent, student);
}

/**
 * Builds the messages a send would produce, without writing anything.
 *
 * Recipients beyond the daily cap are left out rather than silently dropped —
 * the caller reports the difference.
 */
export function buildMessages(
  spec: SendSpec,
  db: Database,
  now: Date,
): { messages: Array<Omit<Message, "id">>; skippedByCap: number } {
  const { settings } = db;
  const recipients = audienceOf(spec.audience, db.students).filter(
    (s) => s.status === "active",
  );

  const sentToday = db.messages.filter((m) => {
    if (m.status !== "sent" || !m.sentAt) return false;
    const d = new Date(m.sentAt);
    return d.toDateString() === now.toDateString();
  }).length;

  const room = Math.max(0, settings.dailyCap - sentToday);
  const going = recipients.slice(0, room);

  // Sends are spaced by the configured gap so they never leave as one burst.
  const messages = going.map((student, i) => {
    const spread =
      i *
      (settings.delayMinSeconds +
        Math.random() * (settings.delayMaxSeconds - settings.delayMinSeconds)) *
      1000;
    const at = new Date(now.getTime() + spread);
    return {
      studentId: student.id,
      nudgeId: spec.nudgeId,
      text: composeFor(student, spec, settings),
      status: "queued" as const,
      channel: "text" as const,
      scheduledAt: at.toISOString(),
      sentAt: null,
    };
  });

  return { messages, skippedByCap: recipients.length - going.length };
}

export function specFromNudge(nudge: Nudge): SendSpec {
  return {
    audience: nudge.audience,
    intent: nudge.intent,
    tone: nudge.tone,
    personalize: nudge.personalize,
    nudgeId: nudge.id,
  };
}

/**
 * Active nudges whose slot has arrived today and that have not already run
 * for it. Quiet hours hold everything back.
 */
export function dueNudges(db: Database, now: Date): Nudge[] {
  if (isQuietHour(now.getHours(), db.settings)) return [];

  const today = weekdayIndex(now);
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  return db.nudges.filter((n) => {
    if (n.status !== "active") return false;
    if (!n.days.includes(today)) return false;
    if (n.hour * 60 + n.minute > minutesNow) return false;
    if (n.lastRunAt) {
      const last = new Date(n.lastRunAt);
      if (last.toDateString() === now.toDateString()) return false;
    }
    return true;
  });
}

/** Human-readable reason autopilot is not sending, or null when it is. */
export function autopilotBlockedReason(db: Database, now: Date): string | null {
  if (!db.settings.autopilot) return "Autopilot is off";
  if (isQuietHour(now.getHours(), db.settings)) return "Quiet hours";
  const active = db.nudges.filter((n) => n.status === "active").length;
  if (active === 0) return "No active nudges";
  return null;
}
