"use client";

import Link from "next/link";
import { useState } from "react";
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
        <Button variant="primary" onClick={() => setOpenStudent("new")}>
          Add student
        </Button>
      }
    >
      <StudentsNav />

      <ExamAlerts />

      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <IconSearch className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or @username"
            className="pl-10"
            aria-label="Search students"
          />
        </div>
        <div className="seg w-auto">
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
              className="seg-btn px-4"
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
            const pay = payStanding(st, db);
            return (
              <Link key={st.id} href={`/students/${st.id}`} className="set-row">
                <span className="w-10 h-10 shrink-0 rounded-full bg-mint text-forest grid place-items-center text-[12px] font-bold">
                  {initials(st.name)}
                </span>

                <span className="set-text">
                  <span className="set-title block">{st.name}</span>
                  <span className="set-sub block">
                    {course?.name ?? "No course"}
                  </span>
                </span>

                {/* One mark, read at a glance. */}
                {pay.state === "none" ? null : (
                  <span className="flex items-center gap-2 shrink-0">
                    <span
                      className={cx(
                        "w-2 h-2 rounded-full",
                        pay.state === "paid"
                          ? "bg-accent"
                          : pay.state === "part"
                            ? "bg-chip-amber"
                            : "bg-clay",
                      )}
                    />
                    <span
                      className={cx(
                        "text-[12.5px] font-semibold",
                        pay.state === "paid"
                          ? "text-accent"
                          : pay.state === "part"
                            ? "text-chip-amber"
                            : "text-clay",
                      )}
                    >
                      {pay.state === "paid"
                        ? "Paid"
                        : pay.state === "part"
                          ? pay.label
                          : "Unpaid"}
                    </span>
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
