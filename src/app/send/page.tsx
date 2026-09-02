"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/AppShell";
import { Badge, Button, Field, Select, Textarea, Toggle, cx } from "@/components/ui";
import { useStore } from "@/lib/store/StoreProvider";
import { composeFor, isQuietHour } from "@/lib/engine/send";
import { audienceOf, groupNameOf, initials } from "@/lib/format";
import type { Audience, Tone } from "@/lib/types";

const TONES: Tone[] = ["warm", "direct", "playful", "formal"];

export default function SendPage() {
  const router = useRouter();
  const { db, sendNow } = useStore();
  const [audience, setAudience] = useState<Audience>({ kind: "all" });
  const [intent, setIntent] = useState("");
  const [tone, setTone] = useState<Tone>(db.settings.defaultTone);
  const [personalized, setPersonalized] = useState(true);
  const [result, setResult] = useState<{ queued: number; skipped: number } | null>(
    null,
  );

  const groups = db.groups;
  const recipients = useMemo(
    () => audienceOf(audience, db.students).filter((s) => s.status === "active"),
    [audience, db.students],
  );

  const quiet = isQuietHour(new Date().getHours(), db.settings);
  const canSend = intent.trim().length > 0 && recipients.length > 0;

  const send = () => {
    const r = sendNow({
      audience,
      intent: intent.trim(),
      tone,
      personalize: personalized,
      nudgeId: null,
    });
    setResult({ queued: r.queued, skipped: r.skippedByCap });
    setIntent("");
  };

  if (result) {
    return (
      <Page title="Sent">
        <div className="card p-8 max-w-[560px]">
          <p className="figure text-[44px] text-forest">{result.queued}</p>
          <p className="mt-3 text-[15px] font-semibold">
            {db.settings.telegramConnected
              ? "messages on their way"
              : "messages queued"}
          </p>
          <p className="mt-2 text-[13.5px] text-muted leading-relaxed">
            {db.settings.telegramConnected
              ? `They go out spaced ${db.settings.delayMinSeconds}–${db.settings.delayMaxSeconds} seconds apart so they do not arrive as one burst.`
              : "They will stay queued until you connect a Telegram account in Settings."}
            {result.skipped > 0
              ? ` ${result.skipped} were held back by today's cap of ${db.settings.dailyCap}.`
              : ""}
          </p>
          <div className="flex gap-2 mt-7">
            <Button variant="primary" onClick={() => router.push("/messages")}>
              See messages
            </Button>
            <Button onClick={() => setResult(null)}>Send another</Button>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Send now"
      subtitle="One message, written for each student, going out the moment you press send."
    >
      <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
        <div className="card p-6 md:p-7 space-y-6">
          <Field label="Who">
            <div className="grid sm:grid-cols-3 gap-2.5">
              <Pick
                on={audience.kind === "all"}
                onClick={() => setAudience({ kind: "all" })}
                title="Everyone"
                body={`${db.students.filter((s) => s.status === "active").length} active`}
              />
              <Pick
                on={audience.kind === "group"}
                onClick={() =>
                  setAudience({ kind: "group", groupId: groups[0]?.id ?? "" })
                }
                title="One group"
                body="Pick a class"
              />
              <Pick
                on={audience.kind === "picked"}
                onClick={() => setAudience({ kind: "picked", studentIds: [] })}
                title="Hand-picked"
                body="Choose students"
              />
            </div>
          </Field>

          {audience.kind === "group" ? (
            <Select
              value={audience.groupId}
              onChange={(e) =>
                setAudience({ kind: "group", groupId: e.target.value })
              }
              aria-label="Course"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          ) : null}

          {audience.kind === "picked" ? (
            <div className="rounded-[18px] bg-field max-h-[240px] overflow-y-auto p-2">
              {db.students
                .filter((s) => s.status === "active")
                .map((s) => {
                  const on = audience.studentIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-[12px] cursor-pointer hover:bg-paper"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setAudience({
                            kind: "picked",
                            studentIds: on
                              ? audience.studentIds.filter((x) => x !== s.id)
                              : [...audience.studentIds, s.id],
                          })
                        }
                        className="accent-[#12a873] w-4 h-4"
                      />
                      <span className="text-[13.5px] flex-1">{s.name}</span>
                      <span className="text-[12px] text-faint">
                        {groupNameOf(s, db.groups)}
                      </span>
                    </label>
                  );
                })}
            </div>
          ) : null}

          <Field
            label="What do you want to say?"
            hint="Write the point, not the wording. Each student gets their own version of it."
          >
            <Textarea
              rows={4}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Remind them the homework is due tomorrow and tell them I am proud of this week's work."
            />
          </Field>

          <div className="flex flex-wrap items-center gap-4">
            <Field label="Tone">
              <Select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="w-[160px]"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center gap-3 pt-6">
              <Toggle
                checked={personalized}
                onChange={setPersonalized}
                label="Write a different message for each student"
              />
              <span className="text-[13.5px]">Personalise per student</span>
            </div>
          </div>

          {quiet ? (
            <p className="text-[13px] text-clay bg-clay-soft rounded-[16px] px-4 py-3">
              It is inside your quiet hours. Sending now still works — quiet hours
              only hold back autopilot.
            </p>
          ) : null}

          <div className="flex items-center gap-3 pt-1">
            <Button variant="primary" onClick={send} disabled={!canSend}>
              Send to {recipients.length} student
              {recipients.length === 1 ? "" : "s"}
            </Button>
            {!db.settings.telegramConnected ? (
              <span className="text-[12.5px] text-muted">
                Telegram is off — these will queue.
              </span>
            ) : null}
          </div>
        </div>

        {/* Live preview */}
        <div className="card p-6">
          <div className="flex items-baseline justify-between mb-4">
            <span className="label">Preview</span>
            <span className="text-[12px] text-faint">
              {Math.min(recipients.length, 4)} of {recipients.length}
            </span>
          </div>
          {intent.trim() === "" ? (
            <p className="text-[13.5px] text-faint">
              Start typing and you will see exactly what each student receives.
            </p>
          ) : (
            <ul className="space-y-4">
              {recipients.slice(0, 4).map((s) => (
                <li key={s.id}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-7 h-7 rounded-full bg-mint text-forest flex items-center justify-center text-[10.5px] font-bold">
                      {initials(s.name)}
                    </span>
                    <span className="text-[12.5px] font-semibold">{s.name}</span>
                  </div>
                  <p className="text-[13px] leading-relaxed bg-mint text-forest rounded-[18px] rounded-tl-[4px] px-4 py-3">
                    {composeFor(
                      s,
                      {
                        audience,
                        intent: intent.trim(),
                        tone,
                        personalize: personalized,
                        nudgeId: null,
                      },
                      db.settings,
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Page>
  );
}

function Pick({
  on,
  onClick,
  title,
  body,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "text-left px-4 py-3.5 rounded-[18px] transition-colors",
        on ? "bg-mint text-forest" : "bg-field hover:bg-line",
      )}
    >
      <span className="block text-[13.5px] font-bold">{title}</span>
      <span
        className={cx(
          "block text-[12.5px] mt-0.5",
          on ? "text-forest/70" : "text-muted",
        )}
      >
        {body}
      </span>
    </button>
  );
}
