"use client";

import { cx } from "@/components/ui";
import type { Match } from "@/lib/similar";

/**
 * Warns that a name already exists, without ever standing in the way.
 *
 * Two courses really can be near-identical — "Grade 10 Monday" and "Grade 10
 * Thursday" — so this only ever asks the teacher to confirm.
 */
export function DuplicateWarning<T extends { id: string; name: string }>({
  matches,
  noun,
  confirmed,
  onConfirm,
}: {
  matches: Match<T>[];
  /** "course" or "student". */
  noun: string;
  confirmed: boolean;
  onConfirm: (value: boolean) => void;
}) {
  if (matches.length === 0) return null;

  const best = matches[0];
  const others = matches.length - 1;

  return (
    <div
      role="alert"
      className={cx(
        "rounded-[18px] px-4 py-3.5 border",
        confirmed
          ? "bg-field border-transparent"
          : "bg-clay-soft border-clay/25",
      )}
    >
      <p
        className={cx(
          "text-[13.5px] font-bold",
          confirmed ? "text-muted" : "text-clay",
        )}
      >
        {best.exact
          ? `A ${noun} called "${best.item.name}" already exists`
          : `This looks like "${best.item.name}"`}
      </p>

      <p className="text-[12.5px] text-muted mt-1 leading-relaxed">
        {best.exact
          ? `Adding another with the same name makes them hard to tell apart.`
          : `The names are close enough that they may be the same ${noun}.`}
        {others > 0
          ? ` ${others} other${others === 1 ? "" : "s"} look similar too.`
          : ""}
      </p>

      <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
          className="w-4 h-4 accent-[#c4553d]"
        />
        <span className="text-[13px] font-semibold">
          Add it anyway — it is a different {noun}
        </span>
      </label>
    </div>
  );
}
