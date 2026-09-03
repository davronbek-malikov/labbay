"use client";

import { useMemo, useState } from "react";
import { Page } from "@/components/AppShell";
import { StudentDrawer } from "@/components/students/StudentDrawer";
import { GroupDrawer } from "@/components/students/GroupDrawer";
import { PaymentsPanel } from "@/components/students/PaymentsPanel";
import { ContactCard } from "@/components/students/ContactCard";
import { Badge, Button, EmptyState, Input, cx } from "@/components/ui";
import { IconSearch } from "@/components/icons";
import { useStore } from "@/lib/store/StoreProvider";
import {
  daysUntil,
  initials,
  longDate,
  money,
  since,
  studentsIn,
  totalPaid,
} from "@/lib/format";
import type { Currency, Group, Student } from "@/lib/types";

/** People first — a course is something a person can be put in, not a gate. */
type Tab = "people" | "group" | "individual";

export default function StudentsPage() {
  const { db } = useStore();
  const [tab, setTab] = useState<Tab>("people");
  const [contact, setContact] = useState<Student | null>(null);
  const [query, setQuery] = useState("");

  const [openGroup, setOpenGroup] = useState<Group | "new" | null>(null);
  const [openStudent, setOpenStudent] = useState<Student | "new" | null>(null);
  const [payingFor, setPayingFor] = useState<Student | null>(null);
  const [insideGroup, setInsideGroup] = useState<Group | null>(null);

  const q = query.trim().toLowerCase();
  const courses = db.groups.filter((g) => g.kind === tab);

  const people = [...db.students]
    .filter((st) => {
      if (!q) return true;
      return (
        st.name.toLowerCase().includes(q) ||
        st.telegram.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const visibleCourses = useMemo(
    () =>
      courses.filter((g) => {
        if (!q) return true;
        if (g.name.toLowerCase().includes(q)) return true;
        return studentsIn(g.id, db.students).some((s) =>
          s.name.toLowerCase().includes(q),
        );
      }),
    [courses, db.students, q],
  );

  const drawers = (
    <>
      <GroupDrawer
        open={openGroup !== null}
        group={openGroup === "new" ? null : openGroup}
        kind={tab === "individual" ? "individual" : "group"}
        onClose={() => setOpenGroup(null)}
        onDeleted={() => {
          setOpenGroup(null);
          setInsideGroup(null);
        }}
      />
      <StudentDrawer
        open={openStudent !== null}
        student={openStudent === "new" ? null : openStudent}
        groupId={insideGroup?.id ?? null}
        onClose={() => setOpenStudent(null)}
      />
      <PaymentsPanel student={payingFor} onClose={() => setPayingFor(null)} />
      <ContactCard
        student={contact}
        onClose={() => setContact(null)}
        onEdit={(st) => {
          setContact(null);
          setOpenStudent(st);
        }}
        onPayments={(st) => {
          setContact(null);
          setPayingFor(st);
        }}
      />
    </>
  );

  /* ------------------------------------------------- inside one course */

  if (insideGroup) {
    const live = db.groups.find((g) => g.id === insideGroup.id) ?? insideGroup;
    const members = studentsIn(live.id, db.students);
    return (
      <Page
        title={live.name}
        subtitle={`${members.length} student${members.length === 1 ? "" : "s"} · ${money(live.fee, live.currency)} each`}
        action={
          <div className="flex gap-2">
            <Button onClick={() => setOpenGroup(live)}>Edit course</Button>
            <Button variant="primary" onClick={() => setOpenStudent("new")}>
              Add student
            </Button>
          </div>
        }
      >
        <button
          type="button"
          onClick={() => setInsideGroup(null)}
          className="text-[13.5px] font-semibold text-accent hover:text-forest mb-5"
        >
          ‹ All courses
        </button>

        <CourseDates group={live} />

        <p className="label mt-7 mb-2 px-1">Students · tap one for payments</p>
        {members.length === 0 ? (
          <EmptyState
            title="Nobody on this course yet"
            body="Add a student and their payments will be tracked here."
            action={
              <Button variant="primary" onClick={() => setOpenStudent("new")}>
                Add student
              </Button>
            }
          />
        ) : (
          <div className="set-card">
            {members.map((s) => (
              <StudentRow
                key={s.id}
                student={s}
                fee={live.fee}
                currency={live.currency}
                paid={totalPaid(s.id, db.payments)}
                onClick={() => setPayingFor(s)}
              />
            ))}
          </div>
        )}

        {drawers}
      </Page>
    );
  }

  /* ----------------------------------------------------------- the list */

  return (
    <Page
      title="Students"
      subtitle={`${db.students.filter((s) => s.status === "active").length} active across ${db.groups.length} course${db.groups.length === 1 ? "" : "s"}`}
      action={
        <Button
          variant="primary"
          onClick={() =>
            tab === "people" ? setOpenStudent("new") : setOpenGroup("new")
          }
        >
          {tab === "people"
            ? "Add student"
            : tab === "group"
              ? "New group"
              : "New student"}
        </Button>
      }
    >
      <div className="seg max-w-[380px] mb-5">
        {(["people", "group", "individual"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className="seg-btn"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t === "people" ? "People" : t === "group" ? "Groups" : "Individual"}
          </button>
        ))}
      </div>

      <div className="relative mb-5">
        <IconSearch className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            tab === "people" ? "Search name or @username" : "Search course or student"
          }
          className="pl-10"
          aria-label="Search"
        />
      </div>

      {tab === "people" ? (
        people.length === 0 ? (
          <EmptyState
            title={db.students.length === 0 ? "No students yet" : "Nobody matches that"}
            body={
              db.students.length === 0
                ? "Add a student with their name and @username. A course is optional — you can put them in one later."
                : "Try a different name or handle."
            }
            action={
              db.students.length === 0 ? (
                <Button variant="primary" onClick={() => setOpenStudent("new")}>
                  Add your first student
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="set-card">
            {people.map((st) => {
              const course = db.groups.find((g) => g.id === st.groupId);
              return (
                <button
                  key={st.id}
                  type="button"
                  className="set-row"
                  onClick={() => setContact(st)}
                >
                  <span className="w-10 h-10 shrink-0 rounded-full bg-mint text-forest grid place-items-center text-[12px] font-bold">
                    {initials(st.name)}
                  </span>
                  <span className="set-text">
                    <span className="set-title block">{st.name}</span>
                    <span className="set-sub block">
                      {st.telegram || "No Telegram yet"}
                      {course ? ` · ${course.name}` : ""}
                    </span>
                  </span>
                  <span
                    className={cx(
                      "tabular text-[12px] shrink-0",
                      st.lastContactedAt &&
                        Date.now() - new Date(st.lastContactedAt).getTime() >
                          7 * 86_400_000
                        ? "text-clay"
                        : "text-faint",
                    )}
                  >
                    {since(st.lastContactedAt)}
                  </span>
                </button>
              );
            })}
          </div>
        )
      ) : visibleCourses.length === 0 ? (
        <EmptyState
          title={
            courses.length === 0
              ? tab === "group"
                ? "No groups yet"
                : "No individual students yet"
              : "Nothing matches that"
          }
          body={
            courses.length === 0
              ? tab === "group"
                ? "A group is a class you teach together — give it a name, the dates it runs, and the fee each student pays."
                : "An individual student gets their own start date, end date, final exam, and fee."
              : "Try a different search."
          }
          action={
            courses.length === 0 ? (
              <Button variant="primary" onClick={() => setOpenGroup("new")}>
                {tab === "group" ? "Create a group" : "Add an individual student"}
              </Button>
            ) : null
          }
        />
      ) : tab === "group" ? (
        <ul className="space-y-3">
          {visibleCourses.map((g) => {
            const members = studentsIn(g.id, db.students);
            const collected = members.reduce(
              (sum, s) => sum + totalPaid(s.id, db.payments),
              0,
            );
            const expected = g.fee * members.length;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setInsideGroup(g)}
                  className="card w-full text-left p-5 hover:bg-field/40 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[16px] font-bold">{g.name}</p>
                      <p className="text-[12.5px] text-muted mt-0.5">
                        {members.length} student{members.length === 1 ? "" : "s"} ·{" "}
                        {money(g.fee, g.currency)} each
                      </p>
                    </div>
                    <ExamBadge group={g} />
                  </div>

                  <div className="flex flex-wrap gap-x-7 gap-y-3 mt-4">
                    <Fact label="Starts" value={longDate(g.startDate)} />
                    <Fact label="Ends" value={longDate(g.endDate)} />
                    <Fact label="Final exam" value={longDate(g.finalExamDate)} />
                  </div>

                  {expected > 0 ? (
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-[12px] mb-1.5">
                        <span className="text-muted">Collected</span>
                        <span className="tabular font-semibold">
                          {money(collected, g.currency)} of {money(expected, g.currency)}
                        </span>
                      </div>
                      <Bar value={collected} of={expected} />
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="set-card">
          {visibleCourses.map((g) => {
            const student = studentsIn(g.id, db.students)[0];
            const paid = student ? totalPaid(student.id, db.payments) : 0;
            return (
              <div key={g.id} className="set-row" style={{ cursor: "default" }}>
                <span className="w-10 h-10 shrink-0 rounded-full bg-mint text-forest grid place-items-center text-[12px] font-bold">
                  {student ? initials(student.name) : "—"}
                </span>
                <span className="set-text">
                  <span className="set-title block">{student?.name ?? g.name}</span>
                  <span className="set-sub block">
                    {g.name} · exam {longDate(g.finalExamDate)} ·{" "}
                    {money(paid, g.currency)} of {money(g.fee, g.currency)}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {student ? (
                    <Button onClick={() => setPayingFor(student)}>Payment</Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setInsideGroup(g);
                        setOpenStudent("new");
                      }}
                    >
                      Add student
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setOpenGroup(g)}>
                    Edit
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {drawers}
    </Page>
  );
}

/* ------------------------------------------------------------ small parts */

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

function CourseDates({ group }: { group: Group }) {
  return (
    <div className="card p-5 flex flex-wrap gap-x-9 gap-y-4">
      <Fact label="Starts" value={longDate(group.startDate)} />
      <Fact label="Ends" value={longDate(group.endDate)} />
      <Fact label="Final exam" value={longDate(group.finalExamDate)} />
      <Fact label="Fee" value={money(group.fee, group.currency)} />
    </div>
  );
}

function ExamBadge({ group }: { group: Group }) {
  const days = daysUntil(group.finalExamDate);
  if (days === null) return null;
  if (days < 0) return <Badge tone="quiet">Finished</Badge>;
  if (days === 0) return <Badge tone="clay">Exam today</Badge>;
  if (days <= 14) return <Badge tone="clay">Exam in {days} days</Badge>;
  return <Badge tone="accent">Exam in {days} days</Badge>;
}

function Bar({ value, of }: { value: number; of: number }) {
  const pct = of === 0 ? 0 : Math.min(100, Math.round((value / of) * 100));
  return (
    <div className="h-1.5 rounded-full bg-field overflow-hidden">
      <div
        className={cx("h-full rounded-full", pct >= 100 ? "bg-accent" : "bg-forest")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StudentRow({
  student,
  fee,
  currency,
  paid,
  onClick,
}: {
  student: Student;
  fee: number;
  currency: Currency;
  paid: number;
  onClick: () => void;
}) {
  const owed = Math.max(0, fee - paid);
  return (
    <button type="button" className="set-row" onClick={onClick}>
      <span className="w-10 h-10 shrink-0 rounded-full bg-mint text-forest grid place-items-center text-[12px] font-bold">
        {initials(student.name)}
      </span>
      <span className="set-text">
        <span className="set-title block">{student.name}</span>
        <span className="set-sub block">
          {student.level || student.subject} · heard from you{" "}
          {since(student.lastContactedAt)}
        </span>
      </span>
      <span className="text-right shrink-0">
        <span className="block tabular text-[13px] font-semibold">
          {money(paid, currency)}
        </span>
        <span
          className={cx(
            "block text-[11.5px]",
            owed === 0 ? "text-accent" : "text-clay",
          )}
        >
          {owed === 0 ? "paid in full" : `${money(owed, currency)} left`}
        </span>
      </span>
    </button>
  );
}
