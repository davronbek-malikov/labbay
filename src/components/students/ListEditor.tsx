"use client";

import { useState } from "react";
import { Input, cx } from "@/components/ui";

/**
 * A short editable list — topics, homework, whatever a teacher wants to track.
 *
 * Deliberately unopinionated: no fixed syllabus shape, because every teacher
 * organises a course differently.
 */
export function ListEditor({
  items,
  onChange,
  placeholder,
  emptyHint,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  emptyHint: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  };

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-faint mb-2">{emptyHint}</p>
      ) : (
        <ol className="space-y-1.5 mb-2.5">
          {items.map((item, i) => (
            <li
              key={`${item}-${i}`}
              className="flex items-center gap-2 rounded-[14px] bg-field px-3 py-2"
            >
              <span className="tabular text-[11.5px] text-faint w-5 shrink-0">
                {i + 1}
              </span>
              <span className="text-[13.5px] flex-1 min-w-0 break-words">{item}</span>
              <span className="flex items-center gap-0.5 shrink-0">
                <Arrow label="Move up" dir="up" onClick={() => move(i, i - 1)} dim={i === 0} />
                <Arrow
                  label="Move down"
                  dir="down"
                  onClick={() => move(i, i + 1)}
                  dim={i === items.length - 1}
                />
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  aria-label={`Remove ${item}`}
                  className="w-6 h-6 grid place-items-center text-faint hover:text-clay text-[15px] leading-none"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
      />
    </div>
  );
}

function Arrow({
  label,
  dir,
  onClick,
  dim,
}: {
  label: string;
  dir: "up" | "down";
  onClick: () => void;
  dim: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={dim}
      className={cx(
        "w-6 h-6 grid place-items-center text-[13px] leading-none",
        dim ? "text-line" : "text-faint hover:text-forest",
      )}
    >
      {dir === "up" ? "↑" : "↓"}
    </button>
  );
}
