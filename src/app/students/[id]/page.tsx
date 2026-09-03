"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Page } from "@/components/AppShell";
import { StudentDrawer } from "@/components/students/StudentDrawer";
import { PaymentsPanel } from "@/components/students/PaymentsPanel";
import { Badge, Button, Textarea, cx } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import {
  dateTime,
  groupOf,
  initials,
  longDate,
  money,
  paymentsOf,
  since,
  totalPaid,
} from "@/lib/format";
import type { Student } from "@/lib/types";

/** Everything about one student, on one page. */
export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { db, ready, sendNow } = useStore();

  const [editing, setEditing] = useState<Student | null>(null);
  const [paying, setPaying] = useState<Student | null>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const student = db.students.find((s) => s.id === params.id);

  if (!ready) return null;

  if (!student) {
    return (
      <Page title="Student not found">
        <p className="text-[13.5px] text-muted mb-5">
          They were removed, or the link is wrong.
        </p>
        <Button onClick={() => router.push("/students")}>Back to students</Button>
      </Page>
    );
  }

  const course = groupOf(student, db.groups);
  const paid = totalPaid(student.id, db.payments);
  const payments = paymentsOf(student.id, db.payments);
  const owed = course ? Math.max(0, course.fee - paid) : 0;
  const currency = course?.currency ?? "UZS";

  const messages = db.messages
    .filter((m) => m.studentId === student.id)
    .sort(
      (a, b) =>
        new Date(b.sentAt ?? b.scheduledAt).getTime() -
        new Date(a.sentAt ?? a.scheduledAt).getTime(),
    );
  const delivered = messages.filter((m) => m.status === "sent").length;

  const send = () => {
    const body = text.trim();
    if (!body) return;
    sendNow({
      audience: { kind: "picked", studentIds: [student.id] },
      intent: body,
      tone: db.settings.defaultTone,
      personalize: false,
      nudgeId: null,
    });
    setText("");
    setSent(
      db.settings.telegramConnected
        ? "On its way."
        : "Queued — sending is off in Settings.",
    );
    window.setTimeout(() => setSent(null), 4000);
  };

  return (
    <Page
      title={student.name}
      subtitle={course ? course.name : "No course"}
      backHref="/students"
      action={
        <div className="flex gap-2">
          <Button onClick={() => setEditing(student)}>Edit</Button>
          {course ? (
            <Button variant="primary" onClick={() => setPaying(student)}>
              Payments
            </Button>
          ) : null}
        </div>
      }
    >
      <Link
        href="/students"
        className="hidden md:inline-block text-[13.5px] font-semibold text-accent hover:text-forest mb-5"
      >
        ‹ All students
      </Link>

      {/* Who */}
      <div className="card p-5 flex flex-wrap items-center gap-4">
        <span className="w-16 h-16 shrink-0 rounded-full bg-mint text-forest grid place-items-center text-[20px] font-bold">
          {initials(student.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-bold truncate">{student.name}</p>
          <p className="tabular text-[13px] text-muted truncate">
            {student.telegram || "No Telegram yet"}
          </p>
          <p className="text-[12.5px] text-faint truncate">
            {[student.subject, student.level].filter(Boolean).join(" · ") ||
              "No subject set"}
          </p>
        </div>
        <Badge tone={student.status === "active" ? "accent" : "quiet"}>
          {student.status === "active" ? "Active" : "Paused"}
        </Badge>
      </div>

      {/* The four numbers that matter */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Stat label="Paid" value={money(paid, currency)} />
        <Stat
          label={owed > 0 ? "Still to pay" : "Balance"}
          value={course ? money(owed, currency) : "—"}
          tone={owed > 0 ? "clay" : "accent"}
        />
        <Stat label="Messages sent" value={String(delivered)} />
        <Stat
          label="Last heard from you"
          value={since(student.lastContactedAt)}
          tone={
            student.lastContactedAt &&
            Date.now() - new Date(student.lastContactedAt).getTime() >
              7 * 86_400_000
              ? "clay"
              : "neutral"
          }
        />
      </section>

      {/* Write to them */}
      <section className="card p-5 mt-4">
        <p className="label mb-2.5">Send a message</p>
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          placeholder={`Write to ${student.name.split(" ")[0]}…`}
        />
        <div className="flex items-center gap-3 mt-3">
          <Button variant="primary" onClick={send} disabled={!text.trim()}>
            Send
          </Button>
          {sent ? (
            <span className="text-[12.5px] text-accent font-semibold">{sent}</span>
          ) : (
            <span className="text-[12px] text-faint">
              Goes exactly as you write it
            </span>
          )}
        </div>
        {!student.telegram ? (
          <p className="text-[12.5px] text-clay mt-3">
            Add their @username before this can reach them.
          </p>
        ) : null}
      </section>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        {/* Course */}
        {course ? (
          <section className="card p-5">
            <div className="flex items-baseline justify-between mb-3">
              <p className="label">Course</p>
              <Link
                href="/courses"
                className="text-[12px] text-accent hover:text-forest"
              >
                Open
              </Link>
            </div>
            <p className="text-[15px] font-bold">{course.name}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
              <Fact label="Starts" value={longDate(course.startDate)} />
              <Fact label="Ends" value={longDate(course.endDate)} />
              <Fact label="Final exam" value={longDate(course.finalExamDate)} />
            </div>
            {course.topics.length ? (
              <>
                <p className="label mt-4 mb-2">Topics</p>
                <ol className="space-y-1">
                  {course.topics.slice(0, 6).map((t, i) => (
                    <li key={i} className="text-[13px] flex gap-2">
                      <span className="tabular text-[11px] text-faint pt-0.5">
                        {i + 1}
                      </span>
                      {t}
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </section>
        ) : (
          <section className="card p-5">
            <p className="label mb-2">Course</p>
            <p className="text-[13.5px] text-muted">
              Not on a course. Use Edit to put them on one.
            </p>
          </section>
        )}

        {/* Payments */}
        <section className="card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <p className="label">Payments</p>
            {course ? (
              <button
                type="button"
                onClick={() => setPaying(student)}
                className="text-[12px] text-accent hover:text-forest"
              >
                Record one
              </button>
            ) : null}
          </div>
          {payments.length === 0 ? (
            <p className="text-[13px] text-muted">Nothing recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {payments.slice(0, 6).map((p) => (
                <li
                  key={p.id}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="tabular text-[13.5px] font-semibold">
                    {money(p.amount, currency)}
                  </span>
                  <span className="text-[12px] text-faint truncate">
                    {longDate(p.paidAt)}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* What the agent knows */}
      <section className="card p-5 mt-4">
        <p className="label mb-2">What the agent knows</p>
        {student.aiNotes ? (
          <p className="text-[13.5px] text-muted leading-relaxed">
            {student.aiNotes}
          </p>
        ) : (
          <p className="text-[13px] text-faint">
            Nothing yet. Add a note in Edit and every message written to them
            will take it into account.
          </p>
        )}
      </section>

      {/* History */}
      <section className="mt-7">
        <p className="label mb-2 px-1">
          {messages.length === 0
            ? "No messages yet"
            : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
        </p>
        {messages.length > 0 ? (
          <ul className="space-y-2">
            {messages.slice(0, 20).map((m) => (
              <li key={m.id} className="card px-4 py-3">
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
                <p className="text-[13.5px] leading-snug">
                  {m.status === "failed" ? m.error : m.text}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <StudentDrawer
        open={editing !== null}
        student={editing}
        groupId={null}
        onClose={() => setEditing(null)}
      />
      <PaymentsPanel student={paying} onClose={() => setPaying(null)} />
    </Page>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "clay" | "accent";
}) {
  return (
    <div className="card px-4 py-4">
      <p
        className={cx(
          "figure text-[19px]",
          tone === "clay" ? "text-clay" : tone === "accent" ? "text-accent" : "text-ink",
        )}
      >
        {value}
      </p>
      <p className="label mt-2">{label}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="block text-[11px] text-faint uppercase tracking-[0.06em]">
        {label}
      </span>
      <span className="block tabular text-[13px] font-semibold mt-0.5">
        {value}
      </span>
    </span>
  );
}
