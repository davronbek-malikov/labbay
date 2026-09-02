"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { WeekStrip, DAY_NAMES } from "@/components/WeekStrip";
import {
  Badge,
  Button,
  Field,
  Input,
  Select,
  Textarea,
  Toggle,
  cx,
} from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import { personalize, plain } from "@/lib/ai/personalize";
import { audienceOf, groupNameOf, initials, time } from "@/lib/format";
import type {
  Audience,
  Channel,
  Group,
  Language,
  Nudge,
  Student,
  Tone,
} from "@/lib/types";

type Draft = Omit<Nudge, "id" | "createdAt">;

const STEPS = ["Audience", "Schedule", "Message", "Preview"] as const;

const TONES: Array<{ value: Tone; label: string; blurb: string }> = [
  { value: "warm", label: "Warm", blurb: "Encouraging, close to how you speak in class." },
  { value: "direct", label: "Direct", blurb: "Short and plain. No decoration." },
  { value: "playful", label: "Playful", blurb: "Light, a little cheeky. Good for younger groups." },
  { value: "formal", label: "Formal", blurb: "Respectful and measured. Good for parents." },
];

export function emptyDraft(defaultTone: Tone): Draft {
  return {
    name: "",
    audience: { kind: "all" },
    days: [1, 3],
    hour: 19,
    minute: 30,
    intent: "",
    tone: defaultTone,
    channel: "text",
    personalize: true,
    status: "active",
  };
}

export function NudgeBuilder({
  initial,
  nudgeId,
}: {
  initial: Draft;
  /** Present when editing an existing nudge. */
  nudgeId?: string;
}) {
  const router = useRouter();
  const { db, addNudge, updateNudge } = useStore();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(initial);

  const groups = db.groups;
  const recipients = useMemo(
    () => audienceOf(draft.audience, db.students),
    [draft.audience, db.students],
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canContinue = [
    recipients.length > 0,
    draft.days.length > 0,
    draft.intent.trim().length > 0,
    draft.name.trim().length > 0,
  ][step];

  const save = () => {
    if (nudgeId) updateNudge(nudgeId, draft);
    else addNudge(draft);
    router.push("/nudges");
  };

  return (
    <div className="max-w-[860px] mx-auto px-5 md:px-8 py-7 md:py-9">
      <header className="mb-7">
        <button
          type="button"
          onClick={() => router.push("/nudges")}
          className="text-[12.5px] text-muted hover:text-ink mb-3"
        >
          ← Back to nudges
        </button>
        <h1 className="display text-[28px] md:text-[34px]">
          {nudgeId ? "Edit nudge" : "New nudge"}
        </h1>
      </header>

      {/* Steps — a real sequence, so numbering carries meaning. */}
      <ol className="flex items-center gap-1 mb-8 overflow-x-auto">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cx(
                "flex items-center gap-2 h-8 px-3 rounded-[14px] text-[13px] transition-colors",
                i === step && "bg-ink text-white font-medium",
                i < step && "text-muted hover:bg-field",
                i > step && "text-faint cursor-default",
              )}
            >
              <span className="tabular text-[11px] opacity-70">{i + 1}</span>
              {s}
            </button>
            {i < STEPS.length - 1 ? (
              <span className="w-4 h-px bg-line shrink-0" />
            ) : null}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <StepAudience
          audience={draft.audience}
          groups={groups}
          students={db.students}
          recipients={recipients}
          onChange={(a) => set("audience", a)}
        />
      ) : null}

      {step === 1 ? (
        <StepSchedule
          days={draft.days}
          hour={draft.hour}
          minute={draft.minute}
          quietStart={db.settings.quietHoursStart}
          quietEnd={db.settings.quietHoursEnd}
          onDays={(d) => set("days", d)}
          onHour={(h) => set("hour", h)}
          onMinute={(m) => set("minute", m)}
        />
      ) : null}

      {step === 2 ? (
        <StepMessage
          draft={draft}
          onIntent={(v) => set("intent", v)}
          onTone={(v) => set("tone", v)}
          onPersonalize={(v) => set("personalize", v)}
          onChannel={(v) => set("channel", v)}
        />
      ) : null}

      {step === 3 ? (
        <StepPreview
          draft={draft}
          recipients={recipients}
          language={db.settings.language}
          onName={(v) => set("name", v)}
        />
      ) : null}

      <footer className="flex items-center gap-2 mt-9 pt-5 border-t border-line">
        {step > 0 ? (
          <Button onClick={() => setStep((s) => s - 1)}>Back</Button>
        ) : null}
        <div className="flex-1" />
        <span className="text-[12.5px] text-faint mr-1">
          {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
        </span>
        {step < STEPS.length - 1 ? (
          <Button
            variant="primary"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canContinue}
          >
            Continue
          </Button>
        ) : (
          <Button variant="primary" onClick={save} disabled={!canContinue}>
            {nudgeId ? "Save nudge" : "Create nudge"}
          </Button>
        )}
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------- 1. Audience */

function StepAudience({
  audience,
  groups,
  students,
  recipients,
  onChange,
}: {
  audience: Audience;
  groups: Group[];
  students: Student[];
  recipients: Student[];
  onChange: (a: Audience) => void;
}) {
  const picked = audience.kind === "picked" ? audience.studentIds : [];

  return (
    <section className="space-y-5">
      <p className="text-[14px] text-muted">Who should hear from you?</p>

      <div className="grid sm:grid-cols-3 gap-2.5">
        <Choice
          selected={audience.kind === "all"}
          onClick={() => onChange({ kind: "all" })}
          title="Everyone"
          body="All active students"
        />
        <Choice
          selected={audience.kind === "group"}
          onClick={() =>
            onChange({ kind: "group", groupId: groups[0]?.id ?? "" })
          }
          title="One group"
          body="Pick a class"
        />
        <Choice
          selected={audience.kind === "picked"}
          onClick={() => onChange({ kind: "picked", studentIds: [] })}
          title="Hand-picked"
          body="Choose students"
        />
      </div>

      {audience.kind === "group" ? (
        <Field label="Course">
          <Select
            value={audience.groupId}
            onChange={(e) => onChange({ kind: "group", groupId: e.target.value })}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {audience.kind === "picked" ? (
        <div className="card divide-y divide-line max-h-[340px] overflow-y-auto">
          {students
            .filter((s) => s.status === "active")
            .map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-field"
              >
                <input
                  type="checkbox"
                  checked={picked.includes(s.id)}
                  onChange={() =>
                    onChange({
                      kind: "picked",
                      studentIds: picked.includes(s.id)
                        ? picked.filter((p) => p !== s.id)
                        : [...picked, s.id],
                    })
                  }
                  className="accent-[#12a873]"
                />
                <span className="text-[13.5px] flex-1">{s.name}</span>
                <span className="text-[12px] text-faint">{groupNameOf(s, groups)}</span>
              </label>
            ))}
        </div>
      ) : null}

      {recipients.length === 0 ? (
        <p className="text-[13px] text-clay">
          Pick at least one student to continue.
        </p>
      ) : null}
    </section>
  );
}

function Choice({
  selected,
  onClick,
  title,
  body,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "text-left px-4 py-3.5 rounded-[9px] border transition-colors",
        selected
          ? "bg-mint"
          : "border-line hover:border-faint",
      )}
    >
      <span className="block text-[13.5px] font-medium">{title}</span>
      <span className="block text-[12.5px] text-muted mt-0.5">{body}</span>
    </button>
  );
}

/* -------------------------------------------------------------- 2. Schedule */

function StepSchedule({
  days,
  hour,
  minute,
  quietStart,
  quietEnd,
  onDays,
  onHour,
  onMinute,
}: {
  days: number[];
  hour: number;
  minute: number;
  quietStart: number;
  quietEnd: number;
  onDays: (d: number[]) => void;
  onHour: (h: number) => void;
  onMinute: (m: number) => void;
}) {
  const inQuietHours =
    quietStart > quietEnd
      ? hour >= quietStart || hour < quietEnd
      : hour >= quietStart && hour < quietEnd;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[14px] text-muted mb-3">Which days?</p>
        <WeekStrip
          active={days}
          size="lg"
          onToggle={(d) =>
            onDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort())
          }
          label="Days this nudge sends"
        />
        <p className="mt-3 text-[13px] text-muted">
          {days.length === 0
            ? "Pick at least one day."
            : days.map((d) => DAY_NAMES[d]).join(", ")}
        </p>
      </div>

      <div>
        <p className="text-[14px] text-muted mb-3">What time?</p>
        <div className="flex items-center gap-2">
          <Select
            value={hour}
            onChange={(e) => onHour(Number(e.target.value))}
            aria-label="Hour"
            className="w-[78px] tabular"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {String(i).padStart(2, "0")}
              </option>
            ))}
          </Select>
          <span className="tabular text-muted">:</span>
          <Select
            value={minute}
            onChange={(e) => onMinute(Number(e.target.value))}
            aria-label="Minute"
            className="w-[78px] tabular"
          >
            {[0, 15, 30, 45].map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </Select>
        </div>

        {inQuietHours ? (
          <p className="mt-3 text-[13px] text-clay">
            {time(hour, minute)} falls inside your quiet hours (
            {time(quietStart, 0)}–{time(quietEnd, 0)}). Nothing will send then —
            change the time, or widen quiet hours in Settings.
          </p>
        ) : (
          <p className="mt-3 text-[13px] text-muted">
            Messages go out from {time(hour, minute)}, spaced a few minutes apart so
            they do not arrive as a burst.
          </p>
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- 3. Message */

function StepMessage({
  draft,
  onIntent,
  onTone,
  onPersonalize,
  onChannel,
}: {
  draft: Draft;
  onIntent: (v: string) => void;
  onTone: (v: Tone) => void;
  onPersonalize: (v: boolean) => void;
  onChannel: (v: Channel) => void;
}) {
  return (
    <section className="space-y-6">
      <Field
        label="What do you want to get across?"
        hint="Write the point, not the wording. The agent turns it into a message for each student."
      >
        <Textarea
          rows={4}
          value={draft.intent}
          onChange={(e) => onIntent(e.target.value)}
          placeholder="Ask how the homework is going and remind them it is due before the next lesson."
          autoFocus
        />
      </Field>

      <div>
        <span className="label block mb-2">Tone</span>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {TONES.map((t) => (
            <Choice
              key={t.value}
              selected={draft.tone === t.value}
              onClick={() => onTone(t.value)}
              title={t.label}
              body={t.blurb}
            />
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-3.5 rounded-[18px] bg-field">
        <Toggle
          checked={draft.personalize}
          onChange={onPersonalize}
          label="Write a different message for each student"
        />
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium">
            Write a different message for each student
          </p>
          <p className="text-[12.5px] text-muted mt-0.5">
            Uses each student&apos;s name, level, and the notes you keep on them. Turn
            this off to send the same text to everyone.
          </p>
        </div>
      </div>

      <div>
        <span className="label block mb-2">Send as</span>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => onChannel("text")}
            className={cx(
              "px-4 h-9 rounded-[14px] border text-[13px] transition-colors",
              draft.channel === "text"
                ? "bg-mint font-medium"
                : "border-line hover:border-faint",
            )}
          >
            Text
          </button>
          <button
            type="button"
            disabled
            className="px-4 h-9 rounded-[14px] border border-line text-[13px] text-faint cursor-not-allowed inline-flex items-center gap-2"
          >
            Voice <Badge tone="quiet">Soon</Badge>
          </button>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- 4. Preview */

function StepPreview({
  draft,
  recipients,
  language,
  onName,
}: {
  draft: Draft;
  recipients: Student[];
  language: Language;
  onName: (v: string) => void;
}) {
  const shown = recipients.slice(0, 8);

  return (
    <section className="space-y-6">
      <Field label="Name this nudge" hint="Only you see this.">
        <Input
          value={draft.name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Homework check-in"
          autoFocus
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[18px] bg-field bg-shell">
        <WeekStrip active={draft.days} size="sm" tone="quiet" />
        <span className="tabular text-[13px]">{time(draft.hour, draft.minute)}</span>
        <span className="text-[13px] text-muted">
          {recipients.length} student{recipients.length === 1 ? "" : "s"}
        </span>
        <Badge tone={draft.personalize ? "accent" : "neutral"}>
          {draft.personalize ? "Personalised" : "Same for everyone"}
        </Badge>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <span className="label">
            {draft.personalize ? "What each student will get" : "What everyone will get"}
          </span>
          {recipients.length > shown.length ? (
            <span className="text-[12px] text-faint">
              showing {shown.length} of {recipients.length}
            </span>
          ) : null}
        </div>

        <ul className="space-y-2.5">
          {shown.map((s) => (
            <li key={s.id} className="flex gap-3">
              <span className="w-8 h-8 mt-0.5 shrink-0 rounded-full bg-mint text-forest flex items-center justify-center text-[11px] font-bold">
                {initials(s.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[13px] font-medium">{s.name}</span>
                  <span className="text-[11.5px] text-faint truncate">
                    {s.level}
                  </span>
                </div>
                <p className="text-[13.5px] leading-relaxed bg-mint rounded-[10px] rounded-tl-[3px] px-3.5 py-2.5">
                  {draft.personalize
                    ? personalize({
                        student: s,
                        intent: draft.intent,
                        tone: draft.tone,
                        language,
                      })
                    : plain(draft.intent, s)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
