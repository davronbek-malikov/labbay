"use client";

import { cx } from "@/components/ui";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Seven cells, one per weekday. The same object appears wherever the week
 * matters — which days a nudge fires, which days a student heard from you,
 * and how the week is filling up — so the shape reads the same everywhere.
 */
export function WeekStrip({
  active,
  size = "md",
  tone = "accent",
  onToggle,
  label,
}: {
  active: number[];
  size?: "sm" | "md" | "lg";
  tone?: "accent" | "quiet";
  /** When provided the strip becomes a day picker. */
  onToggle?: (day: number) => void;
  label?: string;
}) {
  const sizes = {
    sm: "w-[16px] h-[16px] text-[8.5px] rounded-[5px]",
    md: "w-[26px] h-[26px] text-[10.5px] rounded-[8px]",
    lg: "w-[44px] h-[44px] text-[13px] rounded-[14px]",
  }[size];

  const on =
    tone === "accent"
      ? "bg-accent text-white border-accent"
      : "bg-forest text-white border-forest";

  return (
    <div
      className="inline-flex gap-[3px]"
      role={onToggle ? "group" : undefined}
      aria-label={label}
    >
      {LETTERS.map((letter, i) => {
        const isOn = active.includes(i);
        const cell = (
          <span
            className={cx(
              "inline-flex items-center justify-center border font-bold tabular",
              sizes,
              isOn ? on : "bg-field text-faint border-transparent",
            )}
          >
            {letter}
          </span>
        );
        return onToggle ? (
          <button
            key={i}
            type="button"
            onClick={() => onToggle(i)}
            aria-pressed={isOn}
            aria-label={DAY_NAMES[i]}
            className="transition-transform hover:-translate-y-px"
          >
            {cell}
          </button>
        ) : (
          <span key={i} title={DAY_NAMES[i]}>
            {cell}
          </span>
        );
      })}
    </div>
  );
}
