"use client";

import { useEffect, useState } from "react";
import { Button, Drawer, Field, Input, Select, Textarea } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import type { Student, StudentStatus } from "@/lib/types";

interface Draft {
  name: string;
  telegram: string;
  subject: string;
  level: string;
  aiNotes: string;
  status: StudentStatus;
  groupId: string | null;
}

const blank = (groupId: string | null): Draft => ({
  name: "",
  telegram: "",
  subject: "",
  level: "",
  aiNotes: "",
  status: "active",
  groupId,
});

export function StudentDrawer({
  open,
  student,
  groupId,
  onClose,
}: {
  open: boolean;
  /** Null when adding. */
  student: Student | null;
  /** The course the new student joins. */
  groupId: string | null;
  onClose: () => void;
}) {
  const { db, addStudent, updateStudent, removeStudent } = useStore();
  const [draft, setDraft] = useState<Draft>(blank(groupId));

  useEffect(() => {
    if (!open) return;
    setDraft(
      student
        ? {
            name: student.name,
            telegram: student.telegram,
            subject: student.subject,
            level: student.level,
            aiNotes: student.aiNotes,
            status: student.status,
            groupId: student.groupId,
          }
        : blank(groupId),
    );
  }, [open, student, groupId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    if (!draft.name.trim()) return;
    if (student) updateStudent(student.id, draft);
    else addStudent(draft);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={student ? "Edit student" : "Add student"}
      footer={
        <>
          {student ? (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                if (confirm(`Remove ${student.name} and their payment history?`)) {
                  removeStudent(student.id);
                  onClose();
                }
              }}
            >
              Remove
            </Button>
          ) : null}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!draft.name.trim()}>
            {student ? "Save" : "Add"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Name">
          <Input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Aziza Karimova"
            autoFocus
          />
        </Field>

        <Field
          label="Telegram"
          hint="A handle like @aziza_k, or a phone number in international format."
        >
          <Input
            value={draft.telegram}
            onChange={(e) => set("telegram", e.target.value)}
            placeholder="@aziza_k"
            className="tabular"
          />
        </Field>

        <Field label="Course">
          <Select
            value={draft.groupId ?? ""}
            onChange={(e) => set("groupId", e.target.value || null)}
          >
            <option value="">No course</option>
            {db.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} {g.kind === "individual" ? "(individual)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject">
            <Input
              value={draft.subject}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="English"
            />
          </Field>
          <Field label="Level">
            <Input
              value={draft.level}
              onChange={(e) => set("level", e.target.value)}
              placeholder="B2"
            />
          </Field>
        </div>

        <Field
          label="Notes for the agent"
          hint="What should the agent know when it writes to this student?"
        >
          <Textarea
            rows={4}
            value={draft.aiNotes}
            onChange={(e) => set("aiNotes", e.target.value)}
            placeholder="Shy, rarely asks questions. Needs gentle encouragement."
          />
        </Field>

        <Field label="Status">
          <Select
            value={draft.status}
            onChange={(e) => set("status", e.target.value as StudentStatus)}
          >
            <option value="active">Active — receives nudges</option>
            <option value="paused">Paused — receives nothing</option>
          </Select>
        </Field>
      </div>
    </Drawer>
  );
}
