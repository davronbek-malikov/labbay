"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Page } from "@/components/AppShell";
import { StudentDrawer } from "@/components/students/StudentDrawer";
import { GroupDrawer } from "@/components/students/GroupDrawer";
import { PaymentsPanel } from "@/components/students/PaymentsPanel";
import { SyllabusEditor } from "@/components/students/SyllabusEditor";
import { Badge, Button, EmptyState, Input, cx } from "@/components/ui";
import { IconSearch } from "@/components/icons";
import { useStore } from "@/lib/store/StoreProvider";
import {
  daysUntil,
  initials,
  longDate,
  money,
  studentsIn,
  totalPaid,
} from "@/lib/format";
import type { Group, GroupKind, Student } from "@/lib/types";

/** Courses: what you teach, when it runs, and what it earns. */
export default function CoursesPage() {
  const { db } = useStore();
  const [tab, setTab] = useState<GroupKind>("group");
  const [query, setQuery] = useState("");

  const [openGroup, setOpenGroup] = useState<Group | "new" | null>(null);
  const [openStudent, setOpenStudent] = useState<Student | "new" | null>(null);
  const [payingFor, setPayingFor] = useState<Student | null>(null);
  const [insideGroup, setInsideGroup] = useState<Group | null>(null);

  const q = query.trim().toLowerCase();
  const courses = db.groups.filter((g) => g.kind === tab);

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
        kind={tab}
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
          className="text-[13.5px] font-semibold text-[#e05638] hover:text-[#2c1810] mb-5 flex items-center gap-1 transition-colors"
        >
          ‹ All courses
        </button>

        <CourseDates group={live} />

        {live.notes ? (
          <section className="bg-[#ffffff] border border-[#e6e1d5] rounded-[16px] p-[21px] mt-4 shadow-[0_2px_6px_rgba(44,24,16,0.05)]">
            <p className="text-[11px] font-bold text-[#f59e0b] uppercase tracking-[0.06em] mb-2">Notes</p>
            <p className="text-[13.5px] text-[#2c1810]/70 leading-relaxed whitespace-pre-wrap font-['Plus_Jakarta_Sans',sans-serif]">
              {live.notes}
            </p>
          </section>
        ) : null}

        <SyllabusEditor group={live} />

        <div className="flex flex-wrap items-baseline justify-between gap-2 mt-8 mb-2 px-1">
          <p className="text-[11px] font-bold text-[#2c1810]/60 uppercase tracking-[0.06em]">
            Students · {members.length}
          </p>
          <Link
            href="/students"
            className="text-[12.5px] font-semibold text-[#e05638] hover:text-[#2c1810] transition-colors"
          >
            Manage in Students
          </Link>
        </div>

        {members.length === 0 ? (
          <EmptyState
            title="Nobody on this course yet"
            body="Add students from the Students menu — start typing this course's name and pick it from the list."
            action={
              <Button variant="primary" onClick={() => setOpenStudent("new")}>
                Add student
              </Button>
            }
          />
        ) : (
          <div className="bg-[#ffffff] border border-[#e6e1d5] rounded-[16px] overflow-hidden shadow-[0_2px_6px_rgba(44,24,16,0.05)] divide-y divide-[#e6e1d5]">
            {members.map((s) => (
              <Link key={s.id} href={`/students/${s.id}`} className="flex items-center gap-3.5 p-4 hover:bg-[#f8f6f0] transition-colors">
                <span className="w-9 h-9 shrink-0 rounded-full bg-[#e05638]/10 text-[#e05638] grid place-items-center text-[11.5px] font-bold">
                  {initials(s.name)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-[14px] font-semibold text-[#2c1810] block truncate">{s.name}</span>
                </span>
                <span className="text-[#2c1810]/40 text-[15px]">›</span>
              </Link>
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
      title="Courses"
      subtitle={`${db.groups.length} course${db.groups.length === 1 ? "" : "s"} · ${db.students.filter((s) => s.status === "active").length} active students`}
      action={
        <Button variant="primary" onClick={() => setOpenGroup("new")}>
          {tab === "group" ? "New group" : "New individual"}
        </Button>
      }
    >
      <script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.js"></script>

      <div className="flex bg-[#e6e1d5]/40 p-1 rounded-[16px] max-w-[320px] mb-5 border border-[#e6e1d5]">
        {(["group", "individual"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={cx(
              "flex-1 py-1.5 text-[13px] font-semibold rounded-[8px] transition-all",
              tab === t
                ? "bg-[#ffffff] text-[#2c1810] shadow-[0_2px_6px_rgba(44,24,16,0.05)]"
                : "text-[#2c1810]/60 hover:text-[#2c1810]"
            )}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t === "group" ? "Groups" : "Individual"}
          </button>
        ))}
      </div>

      <div className="relative mb-5">
        <IconSearch className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#2c1810]/40 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search course or student"
          className="pl-10 bg-[#ffffff] border-[#e6e1d5] rounded-[8px] focus:ring-2 focus:ring-[#e05638]"
          aria-label="Search courses"
        />
      </div>

      {visibleCourses.length === 0 ? (
        <EmptyState
          title={
            courses.length === 0
              ? tab === "group"
                ? "No groups yet"
                : "No individual courses yet"
              : "Nothing matches that"
          }
          body={
            courses.length === 0
              ? tab === "group"
                ? "A group is a class you teach together — give it a name, the dates it runs, and the fee each student pays."
                : "An individual course is one student with their own dates, exam, and fee."
              : "Try a different search."
          }
          action={
            courses.length === 0 ? (
              <Button variant="primary" onClick={() => setOpenGroup("new")}>
                {tab === "group" ? "Create a group" : "Create one"}
              </Button>
            ) : null
          }
        />
      ) : tab === "group" ? (
        <ul className="space-y-4">
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
                  className="bg-[#ffffff] border border-[#e6e1d5] rounded-[16px] w-full text-left p-[21px] shadow-[0_2px_6px_rgba(44,24,16,0.05)] hover:shadow-[0_12px_32px_-8px_rgba(224,86,56,0.12)] hover:border-[#e05638]/40 transition-all group"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[17px] font-bold text-[#2c1810] group-hover:text-[#e05638] transition-colors">{g.name}</p>
                      <p className="text-[13px] text-[#2c1810]/60 mt-0.5 font-medium">
                        {members.length} student{members.length === 1 ? "" : "s"} ·{" "}
                        {money(g.fee, g.currency)} each
                        {g.topics.length ? ` · ${g.topics.length} topics` : ""}
                      </p>
                    </div>
                    <ExamBadge group={g} />
                  </div>

                  <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4 pt-4 border-t border-[#e6e1d5]/60">
                    <Fact label="Starts" value={longDate(g.startDate)} />
                    <Fact label="Ends" value={longDate(g.endDate)} />
                    <Fact label="Final exam" value={longDate(g.finalExamDate)} />
                  </div>

                  {expected > 0 ? (
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-[12.5px] mb-1.5">
                        <span className="text-[#2c1810]/60 font-medium">Collected</span>
                        <span className="tabular font-semibold text-[#2c1810]">
                          {money(collected, g.currency)} of{" "}
                          {money(expected, g.currency)}
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
        <div className="bg-[#ffffff] border border-[#e6e1d5] rounded-[16px] overflow-hidden shadow-[0_2px_6px_rgba(44,24,16,0.05)] divide-y divide-[#e6e1d5]">
          {visibleCourses.map((g) => {
            const student = studentsIn(g.id, db.students)[0];
            const paid = student ? totalPaid(student.id, db.payments) : 0;
            return (
              <div key={g.id} className="flex items-center gap-4 p-4 hover:bg-[#f8f6f0]/50 transition-colors" style={{ cursor: "default" }}>
                <span className="w-10 h-10 shrink-0 rounded-full bg-[#f59e0b]/15 text-[#2c1810] grid place-items-center text-[12px] font-bold border border-[#f59e0b]/30">
                  {student ? initials(student.name) : "—"}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-[15px] font-bold text-[#2c1810] block truncate">{student?.name ?? g.name}</span>
                  <span className="text-[12.5px] text-[#2c1810]/60 block truncate mt-0.5">
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
      <span className="block text-[11px] text-[#2c1810]/50 uppercase tracking-[0.06em] font-semibold">
        {label}
      </span>
      <span className="block tabular text-[13.5px] font-semibold text-[#2c1810] mt-0.5">
        {value}
      </span>
    </span>
  );
}

function CourseDates({ group }: { group: Group }) {
  return (
    <div className="bg-[#ffffff] border border-[#e6e1d5] rounded-[16px] p-[21px] flex flex-wrap gap-x-9 gap-y-4 shadow-[0_2px_6px_rgba(44,24,16,0.05)]">
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
  const isLoading = pct < 100;

  return (
    <div className="relative p-1 rounded-[8px] border border-dashed border-[#e6e1d5] shadow-[inset_0_2px_4px_rgba(44,24,16,0.06)] bg-[#f8f6f0]">
      <div className="h-2 rounded-[4px] bg-[#e6e1d5]/50 overflow-hidden relative">
        <div
          className={cx("h-full rounded-[4px] transition-all duration-500", pct >= 100 ? "bg-[#10b981]" : "bg-[#e05638]")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isLoading && (
        <div className="absolute right-2 -top-6 flex items-center gap-1 text-[11px] font-medium text-[#e05638]">
          <iconify-icon icon="svg-spinners:ring-resize" style={{ fontSize: '12px', color: '#e05638' }}></iconify-icon>
          <span>In progress</span>
        </div>
      )}
    </div>
  );
}

<script dangerouslySetInnerHTML={{ __html: `
  document.addEventListener('click', function(e) {
    var target = e.target.closest('button, a, input[type="button"], input[type="submit"]');
    if (target) {
      new Audio('https://cdn.jsdelivr.net/npm/uisfx@0.4.0/sounds/minimal/press.mp3').play();
    }
  });
` }} />