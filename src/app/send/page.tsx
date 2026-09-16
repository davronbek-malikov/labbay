"use client";

import { useMemo, useState, useEffect } from "react";
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

  useEffect(() => {
    if (result && typeof window !== "undefined" && (window as any).confetti) {
      (window as any).confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [result]);

  if (result) {
    return (
      <Page title="Sent">
        <script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.js"></script>
        <script src="https://unpkg.com/@lottiefiles/lottie-player@2.0.4/dist/lottie-player.js"></script>
        <div 
          className="p-10 max-w-[600px] rounded-[10px] border-2 border-[#111114] bg-[#F4F4F6] text-[#111114] font-['Inter',sans-serif]"
          style={{
            boxShadow: '0 4px 0 rgba(17,17,20,1)',
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <p className="text-[52px] font-bold text-[#FF4B2B] leading-none font-['Space_Grotesk',sans-serif]">{result.queued}</p>
              <iconify-icon icon="line-md:confirm-circle" style={{ fontSize: '40px', color: '#0B8F5C' }}></iconify-icon>
            </div>
            <lottie-player src="https://cdn.jsdelivr.net/npm/react-useanimations@2.10.0/lib/checkmark/checkmark.json" background="transparent" speed="1" style={{ width: '60px', height: '60px' }} loop autoplay></lottie-player>
          </div>
          <p className="mt-4 text-[18px] font-bold text-[#111114] font-['Space_Grotesk',sans-serif]">
            {db.settings.telegramConnected
              ? "Messages on their way!"
              : "Messages queued"}
          </p>
          <p className="mt-3 text-[14px] text-[#111114] leading-relaxed">
            {db.settings.telegramConnected
              ? `They go out spaced ${db.settings.delayMinSeconds}–${db.settings.delayMaxSeconds} seconds apart so they do not arrive as one burst.`
              : "They will stay queued until you connect a Telegram account in Settings."}
            {result.skipped > 0
              ? ` ${result.skipped} were held back by today's cap of ${db.settings.dailyCap}.`
              : ""}
          </p>
          <div className="flex gap-4 mt-8">
            <Button 
              variant="primary" 
              onClick={() => router.push("/messages")}
              style={{
                backgroundColor: '#FF4B2B',
                color: '#FFFFFF',
                borderRadius: '6px',
                border: '2px solid #111114',
                boxShadow: '0 2px 0 rgba(17,17,20,1)',
                fontWeight: 'bold',
                fontFamily: "'Space Grotesk', sans-serif"
              }}
            >
              See messages
            </Button>
            <Button 
              onClick={() => setResult(null)}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#111114',
                borderRadius: '6px',
                border: '2px solid #111114',
                boxShadow: '0 2px 0 rgba(17,17,20,1)',
                fontWeight: 'bold',
                fontFamily: "'Space Grotesk', sans-serif"
              }}
            >
              Send another
            </Button>
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
      <script src="https://unpkg.com/@lottiefiles/lottie-player@2.0.4/dist/lottie-player.js"></script>
      <StudentsNav />

      <div className="grid lg:grid-cols-[1fr_420px] gap-8 items-start font-['Inter',sans-serif]">
        <div 
          className="p-8 space-y-8 rounded-[10px] border-2 border-[#111114] bg-[#F4F4F6] text-[#111114]"
          style={{
            boxShadow: '0 4px 0 rgba(17,17,20,1)'
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
                borderRadius: '6px',
                border: '2px solid #111114',
                boxShadow: '0 2px 0 rgba(17,17,20,1)',
                backgroundColor: '#FFFFFF',
                color: '#111114',
                fontFamily: "'Inter', sans-serif"
              }}
            />
          </Field>

          <div>
            <span className="block text-[12px] font-bold text-[#111114] uppercase tracking-wider mb-3 font-['Space_Grotesk',sans-serif]">Who gets it</span>
            <div className="grid sm:grid-cols-3 gap-3">
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
              className="text-[14px] font-bold text-[#FF4B2B] hover:underline transition-colors font-['Space_Grotesk',sans-serif]"
            >
              {showOptions ? "Hide options" : "Options"}
            </button>

            {showOptions ? (
              <div className="flex flex-wrap items-center gap-6 mt-5 p-5 rounded-[6px] bg-[#FFFFFF] border-2 border-[#111114]" style={{ boxShadow: '0 2px 0 rgba(17,17,20,1)' }}>
                <Field label="Tone">
                  <Select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as Tone)}
                    className="w-[180px] rounded-[6px] border-2 border-[#111114] bg-[#FFFFFF] text-[#111114] font-bold"
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
                  <span className="text-[14px] text-[#111114] font-medium">Reword for each student</span>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-[#111114]/80 mt-2 font-medium">
                {personalized
                  ? "Each student gets their own wording, built from your message."
                  : "Everyone gets exactly what you typed."}
              </p>
            )}
          </div>

          {quiet ? (
            <div className="flex items-center gap-3 bg-[#E3341F]/10 border-2 border-[#E3341F] rounded-[6px] p-4 text-[#E3341F]">
              <iconify-icon icon="line-md:close-circle" style={{ fontSize: '24px', color: '#E3341F' }}></iconify-icon>
              <p className="text-[13.5px] font-bold leading-relaxed font-['Space_Grotesk',sans-serif]">
                It is inside your quiet hours. Sending now still works — quiet hours only hold back autopilot.
              </p>
            </div>
          ) : null}

          <div className="flex items-center gap-4 pt-1">
            <Button 
              variant="primary" 
              onClick={send} 
              disabled={!canSend}
              style={{
                backgroundColor: canSend ? '#FF4B2B' : '#F4F4F6',
                color: canSend ? '#FFFFFF' : '#111114',
                borderRadius: '6px',
                border: '2px solid #111114',
                paddingLeft: '24px',
                paddingRight: '24px',
                paddingTop: '12px',
                paddingBottom: '12px',
                boxShadow: canSend ? '0 4px 0 rgba(17,17,20,1)' : 'none',
                opacity: canSend ? 1 : 0.6,
                fontWeight: 'bold',
                fontFamily: "'Space Grotesk', sans-serif"
              }}
            >
              <div className="flex items-center gap-2">
                {canSend ? (
                  <iconify-icon icon="line-md:loading-loop" style={{ fontSize: '18px', color: '#FFFFFF' }}></iconify-icon>
                ) : null}
                <span>
                  Send to {recipients.length} student
                  {recipients.length === 1 ? "" : "s"}
                </span>
              </div>
            </Button>
            {!db.settings.telegramConnected ? (
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#E3341F] bg-[#E3341F]/10 px-3 py-1.5 rounded-[4px] border border-[#E3341F]">
                <iconify-icon icon="line-md:bell-loop" style={{ fontSize: '16px', color: '#E3341F' }}></iconify-icon>
                <span>Telegram is off — these will queue.</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Live preview */}
        <div 
          className="p-8 rounded-[10px] border-2 border-[#111114] bg-[#F4F4F6] text-[#111114]"
          style={{
            boxShadow: '0 4px 0 rgba(17,17,20,1)'
          }}
        >
          <div className="flex items-baseline justify-between mb-5">
            <span className="block text-[12px] font-bold text-[#111114] uppercase tracking-wider font-['Space_Grotesk',sans-serif]">Preview</span>
            <span className="text-[12px] text-[#111114] font-bold">
              {Math.min(recipients.length, 4)} of {recipients.length}
            </span>
          </div>
          {intent.trim() === "" ? (
            <div className="p-8 border-2 border-dashed border-[#111114] rounded-[6px] text-center bg-[#FFFFFF]">
              <iconify-icon icon="svg-spinners:bars-scale" style={{ fontSize: '32px', color: '#FF4B2B', margin: '0 auto 12px block' }}></iconify-icon>
              <p className="text-[14px] text-[#111114] font-medium leading-relaxed font-['Space_Grotesk',sans-serif]">
                Start typing and you will see exactly what each student receives.
              </p>
            </div>
          ) : (
            <ul className="space-y-5">
              {recipients.slice(0, 4).map((s) => (
                <li key={s.id}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-[#FF4B2B] text-white border-2 border-[#111114] flex items-center justify-center text-[12px] font-bold font-['Space_Grotesk',sans-serif]">
                        {initials(s.name)}
                      </span>
                      <span className="text-[14px] font-bold text-[#111114] font-['Space_Grotesk',sans-serif]">{s.name}</span>
                    </div>
                    {s.unpaid ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-[#E3341F] bg-[#E3341F]/10 border border-[#E3341F] px-2 py-0.5 rounded-[4px]">
                        <iconify-icon icon="line-md:close-circle" style={{ fontSize: '12px', color: '#E3341F' }}></iconify-icon>
                        Unpaid Fee
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-[#0B8F5C] bg-[#0B8F5C]/10 border border-[#0B8F5C] px-2 py-0.5 rounded-[4px]">
                        <iconify-icon icon="line-md:confirm-circle" style={{ fontSize: '12px', color: '#0B8F5C' }}></iconify-icon>
                        Paid
                      </span>
                    )}
                  </div>
                  <p 
                    className="text-[14px] leading-relaxed bg-[#FFFFFF] text-[#111114] border-2 border-[#111114] rounded-[6px] p-4"
                    style={{
                      boxShadow: '0 2px 0 rgba(17,17,20,1)'
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
        "text-left px-5 py-4 rounded-[6px] transition-all border-2 font-['Space_Grotesk',sans-serif]",
        on
          ? "bg-[#FF4B2B] text-white border-[#111114] shadow-[0_4px_0_rgba(17,17,20,1)]"
          : "bg-[#FFFFFF] text-[#111114] border-[#111114] shadow-[0_2px_0_rgba(17,17,20,1)] hover:bg-[#F4F4F6]",
      )}
    >
      <span className="block text-[15px] font-bold">{title}</span>
      <span
        className={cx(
          "block text-[13px] mt-1 font-['Inter',sans-serif]",
          on ? "text-white/90 font-medium" : "text-[#111114]/70",
        )}
      >
        {body}
      </span>
    </button>
  );
}