"use client";

import { useState } from "react";
import { Button, Drawer, Textarea, cx } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import {
  dateTime,
  groupOf,
  initials,
  money,
  since,
  totalPaid,
} from "@/lib/format";
import type { Student } from "@/lib/types";

/**
 * One person, the way a phone shows a contact: who they are, a box to write to
 * them, and everything you might want to check while you write.
 *
 * A message typed here is sent exactly as written — no tone to pick, nothing
 * rewritten. The clever per-student wording belongs to nudges, not to typing
 * someone a line.
 */
export function ContactCard({
  student,
  onClose,
  onEdit,
  onPayments,
}: {
  student: Student | null;
  onClose: () => void;
  onEdit: (s: Student) => void;
  onPayments: (s: Student) => void;
}) {
  const { db, sendNow } = useStore();
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  if (!student) return null;

  const course = groupOf(student, db.groups);
  const paid = totalPaid(student.id, db.payments);
  const owed = course ? Math.max(0, course.fee - paid) : 0;

  const history = db.messages
    .filter((m) => m.studentId === student.id)
    .sort(
      (a, b) =>
        new Date(b.sentAt ?? b.scheduledAt).getTime() -
        new Date(a.sentAt ?? a.scheduledAt).getTime(),
    )
    .slice(0, 4);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    sendNow({
      audience: { kind: "picked", studentIds: [student.id] },
      intent: body,
      tone: db.settings.defaultTone,
      // Typed by hand, so it goes exactly as written.
      personalize: false,
      nudgeId: null,
    });
    setText("");
    setSent(
      db.settings.telegramConnected
        ? "On its way."
        : "Queued — sending is switched off in Settings.",
    );
    window.setTimeout(() => setSent(null), 4000);
  };

  return (
    <Drawer open onClose={onClose} title={student.name}>
      {/* Who */}
      <div className="flex items-center gap-3 mb-5">
        <span className="w-14 h-14 shrink-0 rounded-full bg-mint text-forest grid place-items-center text-[17px] font-bold">
          {initials(student.name)}
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-bold truncate">{student.name}</p>
          <p className="tabular text-[13px] text-muted truncate">
            {student.telegram || "No Telegram yet"}
          </p>
          <p className="text-[12.5px] text-faint truncate">
            {course?.name ?? "No course"}
            {student.level ? ` · ${student.level}` : ""}
          </p>
        </div>
      </div>

      {/* Write to them */}
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
        placeholder={`Write to ${student.name.split(" ")[0]}…`}
      />
      <div className="flex items-center gap-3 mt-2.5">
        <Button variant="primary" onClick={send} disabled={!text.trim()}>
          Send message
        </Button>
        {sent ? (
          <span className="text-[12.5px] text-accent font-semibold">{sent}</span>
        ) : (
          <span className="text-[12px] text-faint">
            Sent exactly as you write it
          </span>
        )}
      </div>

      {!student.telegram ? (
        <p className="text-[12.5px] text-clay mt-3">
          Add their @username before this can reach them.
        </p>
      ) : null}

      {/* Money, at a glance */}
      {course ? (
        <button
          type="button"
          onClick={() => onPayments(student)}
          className="w-full text-left card-mint p-4 mt-6 hover:opacity-90 transition-opacity"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-forest">
              {owed === 0 ? "Paid in full" : `${money(owed, course.currency)} to pay`}
            </span>
            <span className="tabular text-[12.5px] text-forest/70">
              {money(paid, course.currency)} of {money(course.fee, course.currency)}
            </span>
          </div>
        </button>
      ) : null}

      {/* Recent messages */}
      <p className="label mt-7 mb-2 px-1">
        {history.length === 0
          ? "Nothing sent yet"
          : `Last heard from you ${since(student.lastContactedAt)}`}
      </p>
      {history.length > 0 ? (
        <ul className="space-y-2">
          {history.map((m) => (
            <li key={m.id} className="rounded-[16px] bg-field px-4 py-3">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="tabular text-[11.5px] text-faint">
                  {dateTime(m.sentAt ?? m.scheduledAt)}
                </span>
                <span
                  className={cx(
                    "text-[11.5px] font-semibold",
                    m.status === "sent"
                      ? "text-accent"
                      : m.status === "failed"
                        ? "text-clay"
                        : "text-faint",
                  )}
                >
                  {m.status === "sent"
                    ? "Sent"
                    : m.status === "failed"
                      ? "Failed"
                      : m.status === "sending"
                        ? "Sending"
                        : "Queued"}
                </span>
              </div>
              <p className="text-[13px] leading-snug">
                {m.status === "failed" ? m.error : m.text}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Notes the agent uses */}
      {student.aiNotes ? (
        <>
          <p className="label mt-7 mb-2 px-1">What the agent knows</p>
          <p className="text-[13px] text-muted leading-relaxed rounded-[16px] bg-field px-4 py-3">
            {student.aiNotes}
          </p>
        </>
      ) : null}

      <div className="flex gap-2 mt-7">
        <Button onClick={() => onEdit(student)}>Edit details</Button>
        {course ? (
          <Button onClick={() => onPayments(student)}>Payments</Button>
        ) : null}
      </div>
    </Drawer>
  );
}
