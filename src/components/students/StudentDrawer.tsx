"use client";

import { useEffect, useState } from "react";
import { Button, Drawer, Field, Input, Select, Textarea } from "@/components/ui";
import { CustomFields } from "@/components/students/CustomFields";
import { DuplicateWarning } from "@/components/DuplicateWarning";
import { CoursePicker } from "@/components/students/CoursePicker";
import { findSimilar } from "@/lib/similar";
import { useStore } from "@/lib/store/StoreProvider";
import type { Student, StudentStatus } from "@/lib/types";

interface Draft {
  levelId: string | null;
  fields: Record<string, string>;
  name: string;
  telegram: string;
  subject: string;
  level: string;
  aiNotes: string;
  status: StudentStatus;
  groupId: string | null;
}

const blank = (groupId: string | null): Draft => ({
  levelId: null,
  fields: {},
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
  const [allowDuplicate, setAllowDuplicate] = useState(false);

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
            levelId: student.levelId,
            fields: student.fields ?? {},
          }
        : blank(groupId),
    );
    setAllowDuplicate(false);
  }, [open, student, groupId]);

  const similar = findSimilar(draft.name, db.students, { skipId: student?.id });
  const blocked = similar.length > 0 && !allowDuplicate;

  // Levels offered are the ones on the course the student is actually on.
  const levels = db.groups.find((g) => g.id === draft.groupId)?.syllabus ?? [];

  // Field names this teacher already uses, so they stay consistent.
  const fieldNames = Array.from(
    new Set(db.students.flatMap((s) => Object.keys(s.fields ?? {}))),
  ).sort();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    if (!draft.name.trim() || blocked) return;
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
          <Button
            variant="primary"
            onClick={save}
            disabled={!draft.name.trim() || blocked}
          >
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

        <DuplicateWarning
          matches={similar}
          noun="student"
          confirmed={allowDuplicate}
          onConfirm={setAllowDuplicate}
        />

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

        <Field
          label="Course"
          hint="Type to search. Leave empty if they are not on a course yet."
        >
          <CoursePicker
            courses={db.groups}
            value={draft.groupId}
            onChange={(groupId) => {
              set("groupId", groupId);
              // A level belongs to a course, so moving course clears it.
              set("levelId", null);
            }}
          />
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

        {levels.length > 0 ? (
          <Field
            label="Where they are on the course"
            hint="Levels come from the course plan."
          >
            <Select
              value={draft.levelId ?? ""}
              onChange={(e) => set("levelId", e.target.value || null)}
            >
              <option value="">Not set</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <CustomFields
          value={draft.fields}
          onChange={(fields) => set("fields", fields)}
          suggestions={fieldNames}
        />

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
