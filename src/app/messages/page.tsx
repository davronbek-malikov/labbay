"use client";

import { useMemo, useState } from "react";
import { Page } from "@/components/AppShell";
import { StudentsNav } from "@/components/students/StudentsNav";
import Link from "next/link";
import { Badge, Button, Drawer, EmptyState, Input, Select, cx } from "@/components/ui";
import { IconSearch } from "@/components/icons";
import { useStore } from "@/lib/store/StoreProvider";
import { dateTime, initials } from "@/lib/format";
import type { Message, MessageStatus } from "@/lib/types";

const STATUS_TONE: Record<MessageStatus, "accent" | "clay" | "neutral"> = {
  sent: "accent",
  failed: "clay",
  queued: "neutral",
  sending: "neutral",
};

const STATUS_LABEL: Record<MessageStatus, string> = {
  sent: "Sent",
  failed: "Failed",
  queued: "Queued",
  sending: "Sending",
};

export default function MessagesPage() {
  const { db, updateMessage } = useStore();
  const { messages, students, nudges } = db;

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | MessageStatus>("all");
  const [nudgeId, setNudgeId] = useState("all");
  const [open, setOpen] = useState<Message | null>(null);

  const studentOf = (id: string) => students.find((s) => s.id === id);
  const nudgeOf = (id: string | null) => nudges.find((n) => n.id === id);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...messages]
      .sort(
        (a, b) =>
          new Date(b.sentAt ?? b.scheduledAt).getTime() -
          new Date(a.sentAt ?? a.scheduledAt).getTime(),
      )
      .filter((m) => {
        if (status !== "all" && m.status !== status) return false;
        if (nudgeId !== "all" && m.nudgeId !== nudgeId) return false;
        if (!q) return true;
        const name = studentOf(m.studentId)?.name.toLowerCase() ?? "";
        return name.includes(q) || m.text.toLowerCase().includes(q);
      });
  }, [messages, query, status, nudgeId, students]);

  const counts = {
    sent: messages.filter((m) => m.status === "sent").length,
    queued: messages.filter((m) => m.status === "queued").length,
    failed: messages.filter((m) => m.status === "failed").length,
  };

  return (
    <Page
      title="Messages"
      subtitle={`${counts.sent} sent · ${counts.queued} queued · ${counts.failed} failed`}
      backHref="/dashboard"
    >
      <script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.js"></script>
      
      <StudentsNav />

      {!db.settings.telegramConnected && counts.queued > 0 ? (
        <div 
          className="p-7 mb-7 rounded-[10px] bg-[#F4F4F6] border-2 border-[#111114] shadow-[0_4px_0_rgba(17,17,20,1)]"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          <div className="flex items-center gap-3 text-[#111114]">
            <iconify-icon icon="line-md:loading-loop" style={{ fontSize: '24px', color: '#FF4B2B' }}></iconify-icon>
            <p className="text-[16px] font-bold text-[#111114]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {counts.queued} message{counts.queued === 1 ? "" : "s"} waiting to go out
            </p>
          </div>
          <p className="text-[14px] text-[#111114] mt-2 leading-relaxed font-normal">
            They stay queued because no Telegram account is connected. Connect one
            in Settings and anything due is sent within a few seconds.
          </p>
          <Link href="/settings">
            <Button variant="primary" className="mt-5 bg-[#FF4B2B] hover:bg-[#FF4B2B]/90 text-white rounded-[6px] border-2 border-[#111114] px-5 py-2.5 font-bold transition-all shadow-[0_4px_0_rgba(17,17,20,1)] active:translate-y-1 active:shadow-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Connect Telegram
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 mb-7" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="relative flex-1 min-w-[210px]">
          <IconSearch className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#111114] pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student or message text"
            className="pl-10 bg-[#FFFFFF] border-2 border-[#111114] text-[#111114] rounded-[6px] shadow-[0_2px_0_rgba(17,17,20,1)] focus:border-[#FF4B2B] focus:ring-[#FF4B2B] font-medium"
            aria-label="Search messages"
          />
        </div>
        <Select
          value={nudgeId}
          onChange={(e) => setNudgeId(e.target.value)}
          aria-label="Filter by nudge"
          className="w-auto min-w-[178px] bg-[#FFFFFF] border-2 border-[#111114] text-[#111114] rounded-[6px] shadow-[0_2px_0_rgba(17,17,20,1)] font-medium"
        >
          <option value="all">All nudges</option>
          {nudges.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          aria-label="Filter by status"
          className="w-auto min-w-[126px] bg-[#FFFFFF] border-2 border-[#111114] text-[#111114] rounded-[6px] shadow-[0_2px_0_rgba(17,17,20,1)] font-medium"
        >
          <option value="all">Any status</option>
          <option value="sent">Sent</option>
          <option value="queued">Queued</option>
          <option value="sending">Sending</option>
          <option value="failed">Failed</option>
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={
            messages.length === 0
              ? "Once your nudges start running, every message shows up here with its exact wording."
              : "No message matches those filters."
          }
        />
      ) : (
        <ul className="bg-[#FFFFFF] rounded-[10px] border-2 border-[#111114] divide-y-2 divide-[#111114] overflow-hidden shadow-[0_4px_0_rgba(17,17,20,1)]" style={{ fontFamily: "'Inter', sans-serif" }}>
          {visible.slice(0, 60).map((m) => {
            const student = studentOf(m.studentId);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setOpen(m)}
                  className="w-full text-left px-6 py-4.5 hover:bg-[#F4F4F6] transition-colors flex gap-4.5 items-start"
                >
                  <span className="w-10 h-10 mt-0.5 shrink-0 rounded-[6px] bg-[#F4F4F6] border-2 border-[#111114] text-[#FF4B2B] flex items-center justify-center text-[12px] font-bold shadow-[0_2px_0_rgba(17,17,20,1)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {student ? initials(student.name) : "—"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-3 flex-wrap mb-1.5">
                      <span className="text-[15px] font-bold text-[#111114]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        {student?.name ?? "Removed student"}
                      </span>
                      <span className="tabular text-[12px] font-medium text-[#111114]/70">
                        {dateTime(m.sentAt ?? m.scheduledAt)}
                      </span>
                      <span className="text-[12px] font-medium text-[#111114]/70 bg-[#F4F4F6] px-2 py-0.5 border border-[#111114] rounded-[4px]">
                        {nudgeOf(m.nudgeId)?.name ?? "One-off"}
                      </span>
                    </span>
                    <span
                      className={cx(
                        "block text-[14px] leading-relaxed line-clamp-2 font-medium",
                        m.status === "failed" ? "text-[#E3341F]" : "text-[#111114]",
                      )}
                    >
                      {m.status === "failed" ? m.error : m.text}
                    </span>
                  </span>
                  <span className="shrink-0 flex items-center gap-2">
                    {m.status === "sending" ? (
                      <iconify-icon icon="line-md:loading-loop" style={{ fontSize: '18px', color: '#111114' }}></iconify-icon>
                    ) : null}
                    <Badge tone={STATUS_TONE[m.status]}>
                      {STATUS_LABEL[m.status]}
                    </Badge>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {visible.length > 60 ? (
        <p className="mt-6 text-[13px] font-medium text-[#111114]/70 text-center" style={{ fontFamily: "'Inter', sans-serif" }}>
          Showing the 60 most recent of {visible.length}.
        </p>
      ) : null}

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title="Message"
        footer={
          open?.status === "failed" ? (
            <Button
              variant="primary"
              onClick={() => {
                try {
                  if (typeof confetti === "function") confetti();
                  new Audio("https://cdn.jsdelivr.net/npm/uisfx@0.4.0/sounds/minimal/success.mp3").play().catch(() => {});
                } catch (e) {}
                updateMessage(open.id, {
                  status: "queued",
                  error: undefined,
                  scheduledAt: new Date().toISOString(),
                });
                setOpen(null);
              }}
              className="bg-[#FF4B2B] hover:bg-[#FF4B2B]/90 text-white rounded-[6px] border-2 border-[#111114] px-5 py-2.5 font-bold shadow-[0_4px_0_rgba(17,17,20,1)] active:translate-y-1 active:shadow-none"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Send again
            </Button>
          ) : null
        }
      >
        {open ? (
          <div className="space-y-7" style={{ fontFamily: "'Inter', sans-serif" }}>
            <div className="flex items-center gap-4 p-3 bg-[#F4F4F6] border-2 border-[#111114] rounded-[8px] shadow-[0_2px_0_rgba(17,17,20,1)]">
              <span className="w-11 h-11 shrink-0 rounded-[6px] bg-[#FFFFFF] border-2 border-[#111114] text-[#FF4B2B] flex items-center justify-center text-[13px] font-bold shadow-[0_2px_0_rgba(17,17,20,1)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {studentOf(open.studentId)
                  ? initials(studentOf(open.studentId)!.name)
                  : "—"}
              </span>
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-[#111114]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {studentOf(open.studentId)?.name ?? "Removed student"}
                </p>
                <p className="tabular text-[13px] font-medium text-[#111114]/70">
                  {studentOf(open.studentId)?.telegram ?? "no handle"}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {open.status === "sending" ? (
                  <iconify-icon icon="line-md:loading-loop" style={{ fontSize: '20px', color: '#111114' }}></iconify-icon>
                ) : open.status === "sent" ? (
                  <iconify-icon icon="line-md:confirm-circle" style={{ fontSize: '20px', color: '#0B8F5C' }}></iconify-icon>
                ) : open.status === "failed" ? (
                  <iconify-icon icon="line-md:close-circle" style={{ fontSize: '20px', color: '#E3341F' }}></iconify-icon>
                ) : null}
                <Badge tone={STATUS_TONE[open.status]}>
                  {STATUS_LABEL[open.status]}
                </Badge>
              </div>
            </div>

            <div>
              <span className="label block mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[#111114]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Message</span>
              <p className="text-[14px] leading-relaxed bg-[#F4F4F6] border-2 border-[#111114] text-[#111114] rounded-[10px] px-5 py-4.5 shadow-[0_4px_0_rgba(17,17,20,1)] font-medium">
                {open.text}
              </p>
            </div>

            {open.status === "queued" && !db.settings.telegramConnected ? (
              <div>
                <span className="label block mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[#111114]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Why it is waiting</span>
                <div className="flex items-start gap-3 text-[#111114] bg-[#FFFFFF] border-2 border-[#111114] rounded-[10px] p-4.5 leading-relaxed shadow-[0_4px_0_rgba(17,17,20,1)] font-medium">
                  <iconify-icon icon="svg-spinners:ring-resize" style={{ fontSize: '20px', color: '#FF4B2B', marginTop: '2px', flexShrink: 0 }}></iconify-icon>
                  <p className="text-[14px] text-[#111114]">
                    No Telegram account is connected, so nothing leaves the app yet.
                    Connect one in Settings.
                  </p>
                </div>
              </div>
            ) : null}

            {open.status === "failed" ? (
              <div>
                <span className="label block mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[#E3341F]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Why it failed</span>
                <p className="text-[14px] font-medium text-[#E3341F] bg-[#E3341F]/10 border-2 border-[#E3341F] rounded-[6px] px-4 py-3 shadow-[0_2px_0_rgba(227,52,31,1)]">
                  {open.error}
                </p>
              </div>
            ) : null}

            <dl className="text-[13px] divide-y-2 divide-[#111114] border-t-2 border-b-2 border-[#111114] font-medium">
              <Row label="Nudge" value={nudgeOf(open.nudgeId)?.name ?? "One-off"} />
              <Row label="Scheduled" value={dateTime(open.scheduledAt)} mono />
              <Row
                label="Sent"
                value={open.sentAt ? dateTime(open.sentAt) : "not yet"}
                mono
              />
              <Row label="Channel" value={open.channel === "text" ? "Text" : "Voice"} />
            </dl>
          </div>
        ) : null}
      </Drawer>
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('click', function(e) {
          const btn = e.target.closest('button, a, select, input');
          if (btn) {
            new Audio('https://cdn.jsdelivr.net/npm/uisfx@0.4.0/sounds/minimal/press.mp3').play().catch(() => {});
          }
        });
      ` }} />
    </Page>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-[#111114]/70 font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{label}</dt>
      <dd className={mono ? "tabular text-[13px] text-[#111114] font-mono font-bold" : "text-[#111114] font-bold"}>{value}</dd>
    </div>
  );
}