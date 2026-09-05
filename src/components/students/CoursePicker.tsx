"use client";

import { useEffect, useRef, useState } from "react";
import { Input, cx } from "@/components/ui";
import { normalise } from "@/lib/similar";
import type { Group } from "@/lib/types";

/**
 * Type a course name and pick it from the list.
 *
 * A plain dropdown stops being usable once a teacher has twenty courses, so
 * this filters as you type while still showing everything on focus.
 */
export function CoursePicker({
  courses,
  value,
  onChange,
}: {
  courses: Group[];
  /** The chosen course id, or null for none. */
  value: string | null;
  onChange: (groupId: string | null) => void;
}) {
  const selected = courses.find((c) => c.id === value) ?? null;
  const [text, setText] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Follow the value when it changes from outside, e.g. opening another student.
  useEffect(() => {
    setText(courses.find((c) => c.id === value)?.name ?? "");
  }, [value, courses]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const query = normalise(text);
  const matches = query
    ? courses.filter((c) => normalise(c.name).includes(query))
    : courses;

  const choose = (course: Group | null) => {
    onChange(course?.id ?? null);
    setText(course?.name ?? "");
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setHighlight(0);
          // Clearing the box means no course, rather than a stale one.
          if (!e.target.value.trim()) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && open && matches[highlight]) {
            e.preventDefault();
            choose(matches[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Start typing a course name"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />

      {open ? (
        <div className="absolute z-20 left-0 right-0 mt-1.5 card lift max-h-[240px] overflow-y-auto py-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(null)}
            className={cx(
              "w-full text-left px-4 py-2.5 text-[13.5px] hover:bg-field",
              value === null && "text-forest font-semibold",
            )}
          >
            No course
          </button>

          {matches.length === 0 ? (
            <p className="px-4 py-2.5 text-[13px] text-muted">
              No course matches that. Create it on the Courses page first.
            </p>
          ) : (
            matches.map((course, i) => (
              <button
                key={course.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(course)}
                onMouseEnter={() => setHighlight(i)}
                className={cx(
                  "w-full text-left px-4 py-2.5 hover:bg-field",
                  i === highlight && "bg-field",
                )}
              >
                <span className="block text-[13.5px] font-medium">
                  {course.name}
                </span>
                <span className="block text-[12px] text-muted">
                  {course.kind === "individual" ? "Individual" : "Group"}
                  {course.syllabus?.length
                    ? ` · ${course.syllabus.length} level${course.syllabus.length === 1 ? "" : "s"}`
                    : ""}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
