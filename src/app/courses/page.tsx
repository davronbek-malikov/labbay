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
          <div className="flex gap-3">
            <Button onClick={() => setOpenGroup(live)}>Edit course</Button>
            <Button variant="primary" onClick={() => setOpenStudent("new")}>
              Add student
            </Button>
          </div>
        }
      >
        <script src="https://unpkg.com/@lottiefiles/lottie-player@2.0.4/dist/lottie-player.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.js"></script>

        <button
          type="button"
          onClick={() => setInsideGroup(null)}
          className="text-[14px] font-['Space_Grotesk',sans-serif] font-bold text-[#FF4B2B] hover:underline mb-6 flex items-center gap-1.5 transition-colors"
        >
          ‹ All courses
        </button>

        <CourseDates group={live} />

        {live.notes ? (
          <section className="bg-[#F4F4F6] border-2 border-[#111114] rounded-[10px] p-[27px] mt-5 shadow-[0_4px_0_#111114]">
            <p className="text-[12px] font-bold text-[#111114] uppercase tracking-[0.08em] mb-2 font-['Space_Grotesk',sans-serif]">Notes</p>
            <p className="text-[14px] text-[#111114] leading-relaxed whitespace-pre-wrap font-['Inter',sans-serif]">
              {live.notes}
            </p>
          </section>
        ) : null}

        <SyllabusEditor group={live} />

        <div className="flex flex-wrap items-baseline justify-between gap-3 mt-10 mb-3 px-1">
          <p className="text-[12px] font-bold text-[#111114] uppercase tracking-[0.08em] font-['Space_Grotesk',sans-serif]">
            Students · {members.length}
          </p>
          <Link
            href="/students"
            className="text-[13px] font-bold text-[#FF4B2B] hover:underline transition-colors font-['Space_Grotesk',sans-serif]"
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
          <div className="bg-[#FFFFFF] border-2 border-[#111114] rounded-[10px] overflow-hidden shadow-[0_4px_0_#111114] divide-y-2 divide-[#111114]">
            {members.map((s) => {
              const paid = totalPaid(s.id, db.payments);
              const hasUnpaid = paid < live.fee;
              return (
                <Link key={s.id} href={`/students/${s.id}`} className="flex items-center gap-4 p-5 hover:bg-[#F4F4F6] transition-colors">
                  <span className="w-10 h-10 shrink-0 rounded-[6px] bg-[#FF4B2B] text-[#FFFFFF] border-2 border-[#111114] grid place-items-center text-[13px] font-bold font-['Space_Grotesk',sans-serif] shadow-[0_2px_0_#111114]">
                    {initials(s.name)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-[15px] font-bold text-[#111114] font-['Space_Grotesk',sans-serif] block truncate">{s.name}</span>
                    <span className="text-[12px] text-[#111114]/70 block truncate mt-0.5 font-['Inter',sans-serif]">
                      Paid: {money(paid, live.currency)} of {money(live.fee, live.currency)}
                    </span>
                  </span>
                  {hasUnpaid && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#E3341F]/10 border-2 border-[#E3341F] text-[#E3341F] text-[11px] font-bold font-['Space_Grotesk',sans-serif]">
                      <lottie-player
                        src="https://cdn.jsdelivr.net/npm/react-useanimations@2.10.0/lib/error/error.json"
                        background="transparent"
                        speed="1"
                        style={{ width: "18px", height: "18px" }}
                        loop
                        autoplay
                      ></lottie-player>
                      Unpaid Fee
                    </span>
                  )}
                  <span className="text-[#111114] text-[18px] font-bold">›</span>
                </Link>
              );
            })}
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
      <script src="https://unpkg.com/@lottiefiles/lottie-player@2.0.4/dist/lottie-player.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.js"></script>

      <div className="flex bg-[#F4F4F6] p-1 rounded-[8px] max-w-[340px] mb-6 border-2 border-[#111114] shadow-[0_2px_0_#111114]">
        {(["group", "individual"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={cx(
              "flex-1 py-2 text-[13px] font-bold font-['Space_Grotesk',sans-serif] rounded-[6px] transition-all",
              tab === t
                ? "bg-[#FF4B2B] text-[#FFFFFF] border-2 border-[#111114] shadow-[0_2px_0_#111114]"
                : "text-[#111114] hover:bg-[#FFFFFF]"
            )}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t === "group" ? "Groups" : "Individual"}
          </button>
        ))}
      </div>

      <div className="relative mb-6">
        <IconSearch className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#111114] pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search course or student"
          className="pl-11 bg-[#FFFFFF] border-2 border-[#111114] rounded-[6px] shadow-[0_2px_0_#111114] focus:ring-0 focus:border-[#FF4B2B] font-['Inter',sans-serif]"
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
        <ul className="space-y-5">
          {visibleCourses.map((g) => {
            const members = studentsIn(g.id, db.students);
            const collected = members.reduce(
              (sum, s) => sum + totalPaid(s.id, db.payments),
              0,
            );
            const expected = g.fee * members.length;
            const hasUnpaidStudents = members.some((s) => totalPaid(s.id, db.payments) < g.fee);

            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setInsideGroup(g)}
                  className="bg-[#F4F4F6] border-2 border-[#111114] rounded-[10px] w-full text-left p-[27px] shadow-[0_4px_0_#111114] hover:translate-y-[-2px] hover:shadow-[0_6px_0_#111114] transition-all group"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[19px] font-bold font-['Space_Grotesk',sans-serif] text-[#111114] group-hover:text-[#FF4B2B] transition-colors">{g.name}</p>
                        {hasUnpaidStudents && (
                          <span className="flex items-center gap-1 text-[#E3341F] bg-[#E3341F]/10 border-2 border-[#E3341F] px-2 py-0.5 rounded-[4px] text-[11px] font-bold font-['Space_Grotesk',sans-serif]">
                            <lottie-player
                              src="https://cdn.jsdelivr.net/npm/react-useanimations@2.10.0/lib/error/error.json"
                              background="transparent"
                              speed="1"
                              style={{ width: "16px", height: "16px" }}
                              loop
                              autoplay
                            ></lottie-player>
                            Unpaid Fees
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[#111114]/80 mt-1 font-['Inter',sans-serif] font-medium">
                        {members.length} student{members.length === 1 ? "" : "s"} ·{" "}
                        {money(g.fee, g.currency)} each
                        {g.topics.length ? ` · ${g.topics.length} topics` : ""}
                      </p>
                    </div>
                    <ExamBadge group={g} />
                  </div>

                  <div className="flex flex-wrap gap-x-10 gap-y-4 mt-5 pt-5 border-t-2 border-[#111114]">
                    <Fact label="Starts" value={longDate(g.startDate)} />
                    <Fact label="Ends" value={longDate(g.endDate)} />
                    <Fact label="Final exam" value={longDate(g.finalExamDate)} />
                  </div>

                  {expected > 0 ? (
                    <div className="mt-5">
                      <div className="flex items-baseline justify-between text-[13px] mb-2 font-['Space_Grotesk',sans-serif]">
                        <span className="text-[#111114] font-bold">Collected</span>
                        <span className="tabular font-bold text-[#111114]">
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
        <div className="bg-[#FFFFFF] border-2 border-[#111114] rounded-[10px] overflow-hidden shadow-[0_4px_0_#111114] divide-y-2 divide-[#111114]">
          {visibleCourses.map((g) => {
            const student = studentsIn(g.id, db.students)[0];
            const paid = student ? totalPaid(student.id, db.payments) : 0;
            const isUnpaid = student && paid < g.fee;

            return (
              <div key={g.id} className="flex items-center gap-5 p-5 hover:bg-[#F4F4F6] transition-colors" style={{ cursor: "default" }}>
                <span className="w-11 h-11 shrink-0 rounded-[6px] bg-[#F4F4F6] text-[#111114] grid place-items-center text-[13px] font-bold font-['Space_Grotesk',sans-serif] border-2 border-[#111114] shadow-[0_2px_0_#111114]">
                  {student ? initials(student.name) : "—"}
                </span>
                <span className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-bold text-[#111114] font-['Space_Grotesk',sans-serif] block truncate">{student?.name ?? g.name}</span>
                    {isUnpaid && (
                      <span className="inline-flex items-center gap-1 text-[#E3341F] bg-[#E3341F]/10 border-2 border-[#E3341F] px-2 py-0.5 rounded-[4px] text-[11px] font-bold font-['Space_Grotesk',sans-serif]">
                        <lottie-player
                          src="https://cdn.jsdelivr.net/npm/react-useanimations@2.10.0/lib/error/error.json"
                          background="transparent"
                          speed="1"
                          style={{ width: "16px", height: "16px" }}
                          loop
                          autoplay
                        ></lottie-player>
                        Unpaid
                      </span>
                    )}
                  </div>
                  <span className="text-[13px] text-[#111114]/70 block truncate mt-0.5 font-['Inter',sans-serif]">
                    {g.name} · exam {longDate(g.finalExamDate)} ·{" "}
                    {money(paid, g.currency)} of {money(g.fee, g.currency)}
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
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
      <span className="block text-[11px] text-[#111114]/70 uppercase tracking-[0.08em] font-bold font-['Space_Grotesk',sans-serif]">
        {label}
      </span>
      <span className="block tabular text-[14px] font-bold font-['Inter',sans-serif] text-[#111114] mt-0.5">
        {value}
      </span>
    </span>
  );
}

function CourseDates({ group }: { group: Group }) {
  return (
    <div className="bg-[#F4F4F6] border-2 border-[#111114] rounded-[10px] p-[27px] flex flex-wrap gap-x-12 gap-y-5 shadow-[0_4px_0_#111114]">
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
    <div className="relative p-1.5 rounded-[6px] border-2 border-[#111114] bg-[#FFFFFF] shadow-[0_2px_0_#111114]">
      <div className="h-3 rounded-[4px] bg-[#F4F4F6] border border-[#111114] overflow-hidden relative">
        <div
          className={cx("h-full rounded-[2px] transition-all duration-500", pct >= 100 ? "bg-[#0B8F5C]" : "bg-[#FF4B2B]")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isLoading ? (
        <div className="absolute right-3 -top-7 flex items-center gap-1.5 text-[11px] font-bold font-['Space_Grotesk',sans-serif] text-[#E3341F]">
          <iconify-icon icon="line-md:loading-loop" style={{ fontSize: '14px', color: '#E3341F' }}></iconify-icon>
          <span>Unpaid balance</span>
        </div>
      ) : (
        <div className="absolute right-3 -top-7 flex items-center gap-1 text-[11px] font-bold font-['Space_Grotesk',sans-serif] text-[#0B8F5C]">
          <iconify-icon icon="line-md:confirm-circle" style={{ fontSize: '14px', color: '#0B8F5C' }}></iconify-icon>
          <span>Fully Paid</span>
        </div>
      )}
    </div>
  );
}