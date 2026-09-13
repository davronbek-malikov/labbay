"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Page } from "@/components/AppShell";
import { StudentDrawer } from "@/components/students/StudentDrawer";
import { PaymentsPanel } from "@/components/students/PaymentsPanel";
import { Button, Textarea, cx } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import {
  daysUntil,
  groupOf,
  longDate,
  money,
  payStanding,
  paymentsOf,
} from "@/lib/format";
import type { Student } from "@/lib/types";

/** One student: are they paid up, when do they start and sit the exam, and a way to reach them. */
export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { db, ready, sendNow } = useStore();

  const [editing, setEditing] = useState<Student | null>(null);
  const [paying, setPaying] = useState<Student | null>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const student = db.students.find((s) => s.id === params.id);
  const course = student ? groupOf(student, db.groups) : undefined;
  const examDays = course?.finalExamDate ? daysUntil(course.finalExamDate) : null;
  const pay = student
    ? payStanding(student, db)
    : { state: "none" as const, paid: 0, fee: 0, owed: 0, currency: "UZS" as const, label: "" };

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

  const lastPayment = paymentsOf(student.id, db.payments)[0] ?? null;

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

  const paidLabel = pay.state === "paid" ? "Paid" : pay.state === "part" ? pay.label : "Unpaid";

  return (
    <Page
      title={student.name}
      subtitle={course ? course.name : "No course"}
      backHref="/students"
      action={
        <div className="flex gap-2">
          <Button onClick={() => setEditing(student)}>Edit</Button>
          <Button variant="primary" onClick={() => setPaying(student)}>
            Add payment
          </Button>
        </div>
      }
    >
      <Link
        href="/students"
        className="hidden md:inline-block text-[13.5px] font-semibold text-accent hover:text-forest mb-5"
      >
        ‹ All students
      </Link>

      <section className="card p-5 grid sm:grid-cols-2 gap-5">
        <Fact
          label="Payment"
          value={paidLabel}
          tone={
            pay.state === "paid" ? "good" : pay.state === "part" ? "warn" : "bad"
          }
          sub={pay.fee > 0 ? `${money(pay.paid, pay.currency)} of ${money(pay.fee, pay.currency)}` : undefined}
        />
        <Fact
          label="Date of payment"
          value={lastPayment ? longDate(lastPayment.paidAt) : "—"}
        />
        <Fact
          label="Course started"
          value={course ? longDate(course.startDate) : "—"}
        />
        <Fact
          label="Exam day"
          value={course ? longDate(course.finalExamDate) : "—"}
          tone={examDays !== null && examDays >= 0 && examDays <= 14 ? "warn" : undefined}
        />
      </section>

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

      <StudentDrawer
        open={editing !== null}
        student={editing}
        groupId={null}
        onClose={() => setEditing(null)}
      />
      <PaymentsPanel
        student={paying}
        startAdding
        onClose={() => setPaying(null)}
      />
    </Page>
  );
}

function Fact({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <p
        className={cx(
          "figure text-[20px] mt-2",
          tone === "good"
            ? "text-forest"
            : tone === "bad"
              ? "text-clay"
              : tone === "warn"
                ? "text-chip-amber"
                : "",
        )}
      >
        {value}
      </p>
      {sub ? <p className="text-[12.5px] text-muted mt-1">{sub}</p> : null}
    </div>
  );
}
