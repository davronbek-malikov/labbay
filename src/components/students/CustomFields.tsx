"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

/**
 * Whatever this teacher needs to know about a student.
 *
 * A maths tutor tracks a school and a target grade; a language tutor tracks a
 * target band and a parent's phone. Rather than guess, the teacher names the
 * fields themselves and they are stored as plain key/value pairs.
 */
export function CustomFields({
  value,
  onChange,
  suggestions = [],
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** Field names already used elsewhere, offered for consistency. */
  suggestions?: string[];
}) {
  const [key, setKey] = useState("");
  const [val, setVal] = useState("");

  const entries = Object.entries(value);

  const add = () => {
    const name = key.trim();
    if (!name) return;
    onChange({ ...value, [name]: val.trim() });
    setKey("");
    setVal("");
  };

  const remove = (name: string) => {
    const next = { ...value };
    delete next[name];
    onChange(next);
  };

  const unused = suggestions.filter((s) => !(s in value));

  return (
    <div>
      <span className="label block mb-2">Your own fields</span>

      {entries.length > 0 ? (
        <div className="space-y-2 mb-3">
          {entries.map(([name, v]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="w-[38%] shrink-0 text-[13px] font-semibold truncate">
                {name}
              </span>
              <Input
                value={v}
                onChange={(e) => onChange({ ...value, [name]: e.target.value })}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => remove(name)}
                aria-label={`Remove ${name}`}
                className="w-8 h-8 shrink-0 rounded-full grid place-items-center text-faint hover:text-clay"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Field name"
          className="w-[38%]"
          list="custom-field-names"
        />
        <datalist id="custom-field-names">
          {unused.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Value"
          className="flex-1"
        />
        <Button onClick={add} disabled={!key.trim()} className="shrink-0">
          Add
        </Button>
      </div>

      {unused.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {unused.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setKey(s)}
              className="px-2.5 h-7 rounded-full bg-field text-[12px] font-medium text-muted hover:bg-mint hover:text-forest"
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted mt-2">
          For example: parent&apos;s phone, school, target band, lesson day.
        </p>
      )}
    </div>
  );
}
