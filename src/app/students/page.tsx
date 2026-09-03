"use client";

import Link from "next/link";
import { useState } from "react";
import { Page } from "@/components/AppShell";
import { StudentDrawer } from "@/components/students/StudentDrawer";
import { StudentsNav } from "@/components/students/StudentsNav";
import { Button, EmptyState, Input, cx } from "@/components/ui";
import { IconSearch } from "@/components/icons";
import { useStore } from "@/lib/store/StoreProvider";
import { initials, since } from "@/lib/format";
import type { Student } from "@/lib/types";

/** Everyone you teach, in one list. Courses live on their own page. */
export default function StudentsPage() {
  const { db } = useStore();
  const [query, setQuery] = useState("");
  const [openStudent, setOpenStudent] = useState<Student | "new" | null>(null);

  const q = query.trim().toLowerCase();

  const people = [...db.students]
    .filter((st) => {
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
      subtitle={`${active} active · ${db.students.length - active} paused`}
      action={
        <Button variant="primary" onClick={() => setOpenStudent("new")}>
          Add student
        </Button>
      }
    >
      <StudentsNav />

      <div className="relative mb-5">
        <IconSearch className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or @username"
          className="pl-10"
          aria-label="Search students"
        />
      </div>

      {people.length === 0 ? (
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
              <Link key={st.id} href={`/students/${st.id}`} className="set-row">
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
