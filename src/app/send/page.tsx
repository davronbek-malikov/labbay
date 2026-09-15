"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/AppShell";
import { StudentsNav } from "@/components/students/StudentsNav";
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
  const [showOptions, setShowOptions] = useState(false);
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
        <script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.js"></script>
        <div 
          className="p-8.5 max-w-[588px] rounded-[28px] border border-[#e6e1d5] bg-white text-[#2c1810]"
          style={{
            boxShadow: '0 12px 32px -8px rgba(224, 86, 56, 0.12), inset 0 2px 4px rgba(0,0,0,0.02)',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}
        >
          <div className="flex items-center gap-3">
            <p className="text-[46px] font-extrabold text-[#e05638] leading-none">{result.queued}</p>
            <iconify-icon icon="line-md:confirm-circle" style={{ fontSize: '36px', color: '#10b981' }}></iconify-icon>
          </div>
          <p className="mt-3.5 text-[16px] font-bold text-[#2c1810]">
            {db.settings.telegramConnected
              ? "messages on their way"
              : "messages queued"}
          </p>
          <p className="mt-2 text-[14px] text-[#2c1810]/70 leading-relaxed">
            {db.settings.telegramConnected
              ? `They go out spaced ${db.settings.delayMinSeconds}–${db.settings.delayMaxSeconds} seconds apart so they do not arrive as one burst.`
              : "They will stay queued until you connect a Telegram account in Settings."}
            {result.skipped > 0
              ? ` ${result.skipped} were held back by today's cap of ${db.settings.dailyCap}.`
              : ""}
          </p>
          <div className="flex gap-2.5 mt-7.5">
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
      subtitle="Write it once. Press send."
    >
      <script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js"></script>
      <StudentsNav />

      <div className="grid lg:grid-cols-[1fr_420px] gap-6.5 items-start font-['Plus_Jakarta_Sans',sans-serif]">
        <div 
          className="p-6.5 md:p-7.5 space-y-6.5 rounded-[28px] border border-[#e6e1d5] bg-white text-[#2c1810]"
          style={{
            boxShadow: '0 12px 32px -8px rgba(224, 86, 56, 0.12), inset 0 1px 3px rgba(44,24,16,0.03)'
          }}
        >
          <Field label="Message">
            <Textarea
              rows={5}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Remind them the homework is due tomorrow."
              autoFocus
              style={{
                borderRadius: '16px',
                borderColor: '#e6e1d5',
                boxShadow: 'inset 0 2px 4px rgba(44, 24, 16, 0.04)',
                backgroundColor: '#f8f6f0',
                color: '#2c1810'
              }}
            />
          </Field>

          <div>
            <span className="block text-[13px] font-bold text-[#2c1810]/80 uppercase tracking-wider mb-2.5">Who gets it</span>
            <div className="grid sm:grid-cols-3 gap-2.5">
              <Pick
                on={audience.kind === "all"}
                onClick={() => setAudience({ kind: "all" })}
                title="Everyone"
                body={`${db.students.filter((x) => x.status === "active").length} active`}
              />
              <Pick
                on={audience.kind === "group"}
                onClick={() =>
                  setAudience({ kind: "group", groupId: groups[0]?.id ?? "" })
                }
                title="One course"
                body="Pick a class"
              />
              <Pick
                on={audience.kind === "picked"}
                onClick={() => setAudience({ kind: "picked", studentIds: [] })}
                title="Some students"
                body="Choose people"
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowOptions((v) => !v)}
              className="text-[13.5px] font-semibold text-[#e05638] hover:text-[#2c1810] transition-colors"
            >
              {showOptions ? "Hide options" : "Options"}
            </button>

            {showOptions ? (
              <div className="flex flex-wrap items-center gap-5.5 mt-4.5 p-4 rounded-[16px] bg-[#f8f6f0] border border-dashed border-[#e6e1d5]">
                <Field label="Tone">
                  <Select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as Tone)}
                    className="w-[168px] rounded-[8px] border-[#e6e1d5] bg-white text-[#2c1810]"
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
                  <span className="text-[14px] text-[#2c1810]">Reword for each student</span>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-[#2c1810]/60 mt-2">
                {personalized
                  ? "Each student gets their own wording, built from your message."
                  : "Everyone gets exactly what you typed."}
              </p>
            )}
          </div>

          {quiet ? (
            <p className="text-[13.5px] text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-[16px] px-4.5 py-3.5 leading-relaxed">
              It is inside your quiet hours. Sending now still works — quiet hours
              only hold back autopilot.
            </p>
          ) : null}

          <div className="flex items-center gap-3.5 pt-1">
            <Button 
              variant="primary" 
              onClick={send} 
              disabled={!canSend}
              style={{
                backgroundColor: canSend ? '#e05638' : undefined,
                borderRadius: '16px',
                paddingLeft: '20px',
                paddingRight: '20px',
                boxShadow: canSend ? '0 4px 12px rgba(224, 86, 56, 0.25)' : undefined
              }}
            >
              <div className="flex items-center gap-2">
                {canSend ? (
                  <iconify-icon icon="line-md:loading-loop" style={{ fontSize: '18px', color: '#ffffff' }}></iconify-icon>
                ) : null}
                <span>
                  Send to {recipients.length} student
                  {recipients.length === 1 ? "" : "s"}
                </span>
              </div>
            </Button>
            {!db.settings.telegramConnected ? (
              <span className="text-[13px] text-[#2c1810]/60">
                Telegram is off — these will queue.
              </span>
            ) : null}
          </div>
        </div>

        {/* Live preview */}
        <div 
          className="p-6.5 rounded-[28px] border border-[#e6e1d5] bg-white text-[#2c1810]"
          style={{
            boxShadow: '0 12px 32px -8px rgba(224, 86, 56, 0.12), inset 0 1px 3px rgba(44,24,16,0.03)'
          }}
        >
          <div className="flex items-baseline justify-between mb-4.5">
            <span className="block text-[13px] font-bold text-[#2c1810]/80 uppercase tracking-wider">Preview</span>
            <span className="text-[12.5px] text-[#2c1810]/50 font-medium">
              {Math.min(recipients.length, 4)} of {recipients.length}
            </span>
          </div>
          {intent.trim() === "" ? (
            <div className="p-6 border border-dashed border-[#e6e1d5] rounded-[16px] text-center bg-[#f8f6f0]/50">
              <iconify-icon icon="line-md:loading-bars" style={{ fontSize: '28px', color: '#f59e0b', margin: '0 auto 8px display block' }}></iconify-icon>
              <p className="text-[14px] text-[#2c1810]/60 leading-relaxed">
                Start typing and you will see exactly what each student receives.
              </p>
            </div>
          ) : (
            <ul className="space-y-4.5">
              {recipients.slice(0, 4).map((s) => (
                <li key={s.id}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-7.5 h-7.5 rounded-full bg-[#f8f6f0] text-[#e05638] border border-[#e6e1d5] flex items-center justify-center text-[11px] font-bold">
                      {initials(s.name)}
                    </span>
                    <span className="text-[13px] font-bold text-[#2c1810]">{s.name}</span>
                  </div>
                  <p 
                    className="text-[13.5px] leading-relaxed bg-[#f8f6f0] text-[#2c1810] border border-[#e6e1d5] rounded-[20px] rounded-tl-[4px] px-4.5 py-3.5"
                    style={{
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
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
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener("click", function(e) {
              var btn = e.target.closest("button, a, input[type='submit']");
              if (btn) {
                new Audio('https://cdn.jsdelivr.net/npm/uisfx@0.4.0/sounds/minimal/press.mp3').play().catch(function(){});
              }
            });
          `,
        }}
      />
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
        "text-left px-4.5 py-3.5 rounded-[16px] transition-all border",
        on
          ? "bg-[#e05638] text-white border-[#e05638] shadow-[0_4px_12px_rgba(224,86,56,0.2)]"
          : "bg-[#f8f6f0] text-[#2c1810] border-[#e6e1d5] hover:bg-white hover:border-[#e05638]/40",
      )}
    >
      <span className="block text-[14px] font-bold">{title}</span>
      <span
        className={cx(
          "block text-[13px] mt-0.5",
          on ? "text-white/80" : "text-[#2c1810]/60",
        )}
      >
        {body}
      </span>
    </button>
  );
}