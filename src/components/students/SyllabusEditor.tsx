"use client";

import { useState } from "react";
import { Button, Input, cx } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import type { Group, Lesson, Level } from "@/lib/types";

const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

const blankLesson = (n: number): Lesson => ({
  id: newId("les"),
  title: `Lesson ${n}`,
  topics: [],
  homework: [],
});

const blankLevel = (n: number): Level => ({
  id: newId("lvl"),
  name: `Level ${n}`,
  lessons: [blankLesson(1)],
});

/**
 * The course plan: levels, the lessons inside them, and what each lesson
 * covers and sets.
 *
 * Nothing here is fixed vocabulary — a teacher can call a level "A1",
 * "Beginner", "Unit 3" or "Term 1" and rename it whenever they like, because
 * no two subjects are organised the same way.
 */
export function SyllabusEditor({ group }: { group: Group }) {
  const { updateGroup } = useStore();
  const [openLevel, setOpenLevel] = useState<string | null>(
    group.syllabus[0]?.id ?? null,
  );

  const syllabus = group.syllabus ?? [];
  const save = (next: Level[]) => updateGroup(group.id, { syllabus: next });

  const patchLevel = (levelId: string, patch: Partial<Level>) =>
    save(syllabus.map((l) => (l.id === levelId ? { ...l, ...patch } : l)));

  const patchLesson = (levelId: string, lessonId: string, patch: Partial<Lesson>) =>
    patchLevel(levelId, {
      lessons: (syllabus.find((l) => l.id === levelId)?.lessons ?? []).map((s) =>
        s.id === lessonId ? { ...s, ...patch } : s,
      ),
    });

  const move = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= syllabus.length) return;
    const next = [...syllabus];
    [next[index], next[to]] = [next[to], next[index]];
    save(next);
  };

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <p className="label">Course plan</p>
        <Button
          onClick={() => {
            const level = blankLevel(syllabus.length + 1);
            save([...syllabus, level]);
            setOpenLevel(level.id);
          }}
        >
          Add level
        </Button>
      </div>

      {syllabus.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-[14px] font-semibold">No plan yet</p>
          <p className="text-[13px] text-muted mt-1.5 max-w-md mx-auto leading-relaxed">
            Break the course into levels, then lessons. Or just tell the
            assistant — &ldquo;add a level called A1 with three lessons&rdquo;.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {syllabus.map((level, i) => {
            const open = openLevel === level.id;
            const lessonCount = level.lessons.length;
            const topicCount = level.lessons.reduce(
              (n, l) => n + l.topics.length,
              0,
            );

            return (
              <div key={level.id} className="card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setOpenLevel(open ? null : level.id)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                  >
                    <span
                      className={cx(
                        "text-faint transition-transform",
                        open && "rotate-90",
                      )}
                    >
                      ›
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-bold truncate">
                        {level.name}
                      </span>
                      <span className="block text-[12px] text-muted">
                        {lessonCount} lesson{lessonCount === 1 ? "" : "s"} ·{" "}
                        {topicCount} topic{topicCount === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <ArrowButton label="Move up" onClick={() => move(i, -1)} up />
                    <ArrowButton label="Move down" onClick={() => move(i, 1)} />
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete "${level.name}" and its lessons?`))
                          save(syllabus.filter((l) => l.id !== level.id));
                      }}
                      className="w-8 h-8 rounded-full grid place-items-center text-faint hover:text-clay"
                      aria-label={`Delete ${level.name}`}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {open ? (
                  <div className="border-t border-line px-4 py-4 space-y-4">
                    <label className="block">
                      <span className="label block mb-1.5">Level name</span>
                      <Input
                        value={level.name}
                        onChange={(e) =>
                          patchLevel(level.id, { name: e.target.value })
                        }
                        placeholder="A1, Beginner, Unit 3…"
                      />
                    </label>

                    {level.lessons.map((lesson, j) => (
                      <div key={lesson.id} className="rounded-[16px] bg-field p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="tabular text-[11.5px] text-faint shrink-0">
                            {j + 1}
                          </span>
                          <Input
                            value={lesson.title}
                            onChange={(e) =>
                              patchLesson(level.id, lesson.id, {
                                title: e.target.value,
                              })
                            }
                            placeholder="Lesson title"
                            className="bg-paper"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              patchLevel(level.id, {
                                lessons: level.lessons.filter(
                                  (s) => s.id !== lesson.id,
                                ),
                              })
                            }
                            className="w-8 h-8 shrink-0 rounded-full grid place-items-center text-faint hover:text-clay"
                            aria-label={`Delete ${lesson.title}`}
                          >
                            ×
                          </button>
                        </div>

                        <ListField
                          label="Topics"
                          placeholder="One topic per line"
                          value={lesson.topics}
                          onChange={(topics) =>
                            patchLesson(level.id, lesson.id, { topics })
                          }
                        />
                        <div className="h-3" />
                        <ListField
                          label="Homework"
                          placeholder="One task per line"
                          value={lesson.homework}
                          onChange={(homework) =>
                            patchLesson(level.id, lesson.id, { homework })
                          }
                        />
                      </div>
                    ))}

                    <Button
                      onClick={() =>
                        patchLevel(level.id, {
                          lessons: [
                            ...level.lessons,
                            blankLesson(level.lessons.length + 1),
                          ],
                        })
                      }
                    >
                      Add lesson
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ArrowButton({
  label,
  onClick,
  up,
}: {
  label: string;
  onClick: () => void;
  up?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-8 h-8 rounded-full grid place-items-center text-faint hover:text-forest hover:bg-field"
    >
      {up ? "↑" : "↓"}
    </button>
  );
}

/** A list edited as lines of text, which is far quicker than row widgets. */
function ListField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = useState(value.join("\n"));

  return (
    <label className="block">
      <span className="label block mb-1.5">{label}</span>
      <textarea
        rows={Math.max(2, Math.min(text.split("\n").length, 8))}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() =>
          onChange(
            text
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean),
          )
        }
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 text-[13.5px] leading-relaxed bg-paper border border-transparent rounded-[14px] placeholder:text-faint focus:border-accent focus:outline-none resize-y"
      />
    </label>
  );
}
