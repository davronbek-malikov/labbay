"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, cx } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import { examAlerts, longDate } from "@/lib/format";

/**
 * Exam dates are easy to lose track of, so this sits at the top of the home
 * screen in red until it is dealt with.
 *
 * Closing it only hides it for this visit — it is back on the next load.
 * Only "I know about this" records the acknowledgement, and even that lapses
 * if the exam is later moved to a different day.
 */
export function ExamAlerts() {
  const { db, acknowledgeExam } = useStore();
  const [hidden, setHidden] = useState<string[]>([]);

  const alerts = examAlerts(db).filter((a) => !hidden.includes(a.group.id));
  if (alerts.length === 0) return null;

  return (
    <section className="space-y-3 mb-8" aria-label="Exam reminders">
      {alerts.map(({ group, students, daysAway }) => {
        const when =
          daysAway === 0
            ? "today"
            : daysAway === 1
              ? "tomorrow"
              : `in ${daysAway} days`;

        const names =
          students.length === 0
            ? "No students on this course yet"
            : students.length <= 3
              ? students.map((s) => s.name).join(", ")
              : `${students
                  .slice(0, 3)
                  .map((s) => s.name.split(" ")[0])
                  .join(", ")} and ${students.length - 3} more`;

        return (
          <div
            key={group.id}
            role="alert"
            className={cx(
              "rounded-[20px] p-5 text-white",
              daysAway <= 2 ? "bg-clay" : "bg-clay/90",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold">
                  {group.name} has an exam {when}
                </p>
                <p className="text-[13px] text-white/85 mt-1">
                  {longDate(group.finalExamDate)}
                  {group.kind === "individual" ? " · individual course" : ""}
                </p>
                <p className="text-[13px] text-white/85 mt-1.5">{names}</p>
              </div>

              <span className="tabular text-[28px] font-bold leading-none shrink-0">
                {daysAway}
                <span className="text-[12px] font-semibold ml-1">
                  {daysAway === 1 ? "day" : "days"}
                </span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                onClick={() => acknowledgeExam(group.id, group.finalExamDate!)}
                className="bg-white text-clay hover:bg-white/90"
              >
                I know about this
              </Button>
              <Link href="/courses">
                <Button className="bg-white/15 text-white hover:bg-white/25">
                  Open course
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setHidden((h) => [...h, group.id])}
                className="h-11 px-4 text-[13px] font-semibold text-white/75 hover:text-white"
              >
                Later
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
