"use client";

import { useEffect, useState } from "react";
import { Button, Drawer, Field, Input, Select } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import { CURRENCIES, studentsIn } from "@/lib/format";
import type { Currency, Group, GroupKind } from "@/lib/types";

interface Draft {
  name: string;
  startDate: string;
  endDate: string;
  finalExamDate: string;
  fee: string;
  currency: Currency;
}

const blank: Draft = {
  name: "",
  startDate: "",
  endDate: "",
  finalExamDate: "",
  fee: "",
  currency: "UZS",
};

const toDraft = (g: Group): Draft => ({
  name: g.name,
  startDate: g.startDate ?? "",
  endDate: g.endDate ?? "",
  finalExamDate: g.finalExamDate ?? "",
  fee: String(g.fee),
  currency: g.currency,
});

/**
 * Creates or edits a course. The same form serves a group and an individual —
 * only the wording changes, because both carry the same facts.
 */
export function GroupDrawer({
  open,
  group,
  kind,
  onClose,
  onDeleted,
}: {
  open: boolean;
  /** Null when creating. */
  group: Group | null;
  kind: GroupKind;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { db, addGroup, updateGroup, removeGroup } = useStore();
  const [draft, setDraft] = useState<Draft>(blank);

  useEffect(() => {
    if (open) setDraft(group ? toDraft(group) : blank);
  }, [open, group]);

  const isGroup = (group?.kind ?? kind) === "group";
  const members = group ? studentsIn(group.id, db.students).length : 0;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    if (!draft.name.trim()) return;
    const payload = {
      name: draft.name.trim(),
      kind: group?.kind ?? kind,
      startDate: draft.startDate || null,
      endDate: draft.endDate || null,
      finalExamDate: draft.finalExamDate || null,
      fee: Number(draft.fee.replace(/\D/g, "")) || 0,
      currency: draft.currency,
    };
    if (group) updateGroup(group.id, payload);
    else addGroup(payload);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        group
          ? isGroup
            ? "Edit group"
            : "Edit course"
          : isGroup
            ? "New group"
            : "New individual course"
      }
      footer={
        <>
          {group ? (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                const warning = members
                  ? `Delete "${group.name}"? Its ${members} student${members === 1 ? "" : "s"} will stay, without a course.`
                  : `Delete "${group.name}"?`;
                if (confirm(warning)) {
                  removeGroup(group.id);
                  onDeleted();
                }
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!draft.name.trim()}>
            {group ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field
          label={isGroup ? "Group name" : "Course name"}
          hint={
            isGroup
              ? "What you call this class — students never see it."
              : "For example: Aziza — IELTS one to one."
          }
        >
          <Input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={isGroup ? "IELTS evening" : "Aziza — private English"}
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starting day">
            <Input
              type="date"
              value={draft.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </Field>
          <Field label="Ending day">
            <Input
              type="date"
              value={draft.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Final exam" hint="Leave empty if there is no exam.">
          <Input
            type="date"
            value={draft.finalExamDate}
            onChange={(e) => set("finalExamDate", e.target.value)}
          />
        </Field>

        <Field
          label="Course fee"
          hint="What one student pays for the whole course."
        >
          {/* Both controls are w-full, so the wrappers own the widths. */}
          <div className="flex gap-2 items-stretch">
            <div className="flex-1 min-w-0">
              <Input
                inputMode="numeric"
                value={draft.fee}
                onChange={(e) => set("fee", e.target.value.replace(/\D/g, ""))}
                placeholder={draft.currency === "USD" ? "300" : "1200000"}
                className="tabular"
              />
            </div>
            <div className="w-[124px] shrink-0">
              <Select
                value={draft.currency}
                onChange={(e) => set("currency", e.target.value as Currency)}
                aria-label="Currency"
                className="px-3"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.short === "so'm" ? "So'm" : c.short === "$" ? "USD" : "Won"}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Field>

        {draft.startDate && draft.endDate && draft.endDate < draft.startDate ? (
          <p className="text-[13px] text-clay">
            The ending day is before the starting day.
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}
