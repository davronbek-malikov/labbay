"use client";

import Link from "next/link";
import { useState } from "react";
import Script from "next/script";
import { Page } from "@/components/AppShell";
import { StudentDrawer } from "@/components/students/StudentDrawer";
import { StudentsNav } from "@/components/students/StudentsNav";
import { ExamAlerts } from "@/components/ExamAlerts";
import { Badge, Button, EmptyState, Input, cx } from "@/components/ui";
import { IconSearch } from "@/components/icons";
import { useStore } from "@/lib/store/StoreProvider";
import { initials, payStanding, since } from "@/lib/format";
import type { Student } from "@/lib/types";

type Filter = "all" | "unpaid" | "quiet";

/** Everyone you teach, and where each of them stands. */
export default function StudentsPage() {
  const { db } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openStudent, setOpenStudent] = useState<Student | "new" | null>(null);

  const q = query.trim().toLowerCase();
  const weekAgo = Date.now() - 7 * 86_400_000;

  const owing = db.students.filter(
    (s) => payStanding(s, db).state !== "paid" && payStanding(s, db).state !== "none",
  ).length;

  const people = [...db.students]
    .filter((st) => {
      if (filter === "unpaid") {
        const state = payStanding(st, db).state;
        if (state === "paid" || state === "none") return false;
      }
      if (filter === "quiet") {
        if (st.lastContactedAt && new Date(st.lastContactedAt).getTime() > weekAgo)
          return false;
      }
      if (!q) return true;
      return (
        st.name.toLowerCase().includes(q) ||
        st.telegram.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const active = db.students.filter((s) => s.status === "active").length;

  return (
    <Page
      title="Students"
      subtitle={`${active} active · ${owing} still owing`}
      action={
        <Button
          variant="primary"
          onClick={() => setOpenStudent("new")}
          className="bg-[#FF4B2B] hover:bg-[#FF4B2B]/90 text-white font-['Space_Grotesk'] font-bold py-2.5 px-5 rounded-[6px] border-2 border-[#111114] shadow-[4px_4px_0px_0px_#111114] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#111114] active:translate-x-[0px] active:translate-y-[0px] active:shadow-[2px_2px_0px_0px_#111114]"
        >
          Add student
        </Button>
      }
    >
      <Script src="https://unpkg.com/@lottiefiles/lottie-player@2.0.4/dist/lottie-player.js" />
      <Script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js" />
      <Script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.js" />

      <StudentsNav />

      <ExamAlerts />

      <div className="flex flex-wrap gap-3.5 mb-6.5 font-['Inter']">
        <div className="relative flex-1 min-w-[280px]">
          <IconSearch className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#111114] pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or @username"
            className="pl-11 pr-4 py-3 bg-[#FFFFFF] border-2 border-[#111114] rounded-[6px] text-[#111114] placeholder-[#111114]/50 shadow-[2px_2px_0px_0px_#111114] focus:shadow-[4px_4px_0px_0px_#111114] focus:outline-none transition-all"
            aria-label="Search students"
          />
        </div>
        <div className="seg flex gap-2 p-1.5 bg-[#F4F4F6] border-2 border-[#111114] rounded-[6px] shadow-[2px_2px_0px_0px_#111114]">
          {(
            [
              ["all", "Everyone"],
              ["unpaid", "Owing"],
              ["quiet", "Gone quiet"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cx(
                "seg-btn px-4 py-2 font-['Space_Grotesk'] font-bold text-sm rounded-[4px] border-2 transition-all",
                filter === value
                  ? "bg-[#FF4B2B] text-white border-[#111114] shadow-[2px_2px_0px_0px_#111114]"
                  : "bg-transparent text-[#111114] border-transparent hover:border-[#111114]/20",
              )}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {people.length === 0 ? (
        <EmptyState
          title={
            db.students.length === 0
              ? "No students yet"
              : filter === "unpaid"
                ? "Everyone has paid"
                : filter === "quiet"
                  ? "Everyone has heard from you"
                  : "Nobody matches that"
          }
          body={
            db.students.length === 0
              ? "Add a student with their name and @username. A course is optional — you can put them in one later."
              : "Try a different search, or another filter."
          }
          action={
            db.students.length === 0 ? (
              <Button
                variant="primary"
                onClick={() => setOpenStudent("new")}
                className="bg-[#FF4B2B] hover:bg-[#FF4B2B]/90 text-white font-['Space_Grotesk'] font-bold py-3 px-6 rounded-[6px] border-2 border-[#111114] shadow-[4px_4px_0px_0px_#111114]"
              >
                Add your first student
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="set-card bg-[#F4F4F6] border-2 border-[#111114] rounded-[10px] shadow-[4px_4px_0px_0px_#111114] divide-y-2 divide-[#111114] overflow-hidden">
          {people.map((st) => {
            const course = db.groups.find((g) => g.id === st.groupId);
            const pay = payStanding(st, db);
            const isUnpaid = pay.state !== "paid" && pay.state !== "none";
            
            return (
              <Link
                key={st.id}
                href={`/students/${st.id}`}
                className="set-row p-4 flex items-center gap-4 bg-[#FFFFFF] hover:bg-[#F4F4F6] transition-colors"
              >
                <span className="w-11 h-11 shrink-0 rounded-full bg-[#FF4B2B] text-white border-2 border-[#111114] grid place-items-center text-sm font-['Space_Grotesk'] font-bold shadow-[2px_2px_0px_0px_#111114]">
                  {initials(st.name)}
                </span>

                <span className="set-text flex-1">
                  <span className="set-title block font-['Space_Grotesk'] font-bold text-[#111114] text-base">
                    {st.name}
                  </span>
                  <span className="set-sub block font-['Inter'] text-xs font-semibold text-[#111114]/70 mt-0.5">
                    {course?.name ?? "No course"}
                  </span>
                </span>

                {/* One mark, read at a glance. */}
                {pay.state === "none" ? null : (
                  <span className="flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-[6px] border-2 border-[#111114] bg-[#FFFFFF] shadow-[2px_2px_0px_0px_#111114]">
                    {pay.state === "paid" ? (
                      <>
                        {/* @ts-ignore */}
                        <iconify-icon icon="line-md:confirm-circle" style={{ fontSize: '18px', color: '#0B8F5C' }}></iconify-icon>
                        <span className="text-[13px] font-['Space_Grotesk'] font-bold text-[#0B8F5C]">
                          Paid
                        </span>
                      </>
                    ) : (
                      <>
                        {/* Alarm red color animation for unpaid/part fee */}
                        {/* @ts-ignore */}
                        <iconify-icon icon="line-md:bell-loop" style={{ fontSize: '18px', color: '#E3341F' }}></iconify-icon>
                        <span className="text-[13px] font-['Space_Grotesk'] font-bold text-[#E3341F]">
                          {pay.state === "part" ? pay.label : "Unpaid"}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <StudentDrawer
        open={openStudent !== null}
        student={openStudent === "new" ? null : openStudent}
        groupId={null}
        onClose={() => setOpenStudent(null)}
      />
    </Page>
  );
}