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
          className="p-5.5 mb-5 rounded-[16px] bg-[#ffffff] border border-dashed border-[#e6e1d5] shadow-[inset_0_2px_4px_rgba(44,24,16,0.03)]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <div className="flex items-center gap-2.5 text-[#2c1810]">
            <iconify-icon icon="line-md:loading-loop" style={{ fontSize: '20px', color: '#f59e0b' }}></iconify-icon>
            <p className="text-[14px] font-bold text-[#2c1810]">
              {counts.queued} message{counts.queued === 1 ? "" : "s"} waiting to go out
            </p>
          </div>
          <p className="text-[13px] text-[#2c1810]/80 mt-1.5 leading-relaxed">
            They stay queued because no Telegram account is connected. Connect one
            in Settings and anything due is sent within a few seconds.
          </p>
          <Link href="/settings">
            <Button variant="primary" className="mt-4 bg-[#e05638] hover:bg-[#e05638]/90 text-white rounded-[8px] px-4 py-2 font-medium transition-all shadow-[0_2px_6px_rgba(44,24,16,0.05)]">
              Connect Telegram
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2.5 mb-5.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="relative flex-1 min-w-[210px]">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/40 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student or message text"
            className="pl-9 bg-[#ffffff] border-[#e6e1d5] text-[#2c1810] rounded-[8px] shadow-[0_2px_6px_rgba(44,24,16,0.05)] focus:border-[#e05638] focus:ring-[#e05638]"
            aria-label="Search messages"
          />
        </div>
        <Select
          value={nudgeId}
          onChange={(e) => setNudgeId(e.target.value)}
          aria-label="Filter by nudge"
          className="w-auto min-w-[178px] bg-[#ffffff] border-[#e6e1d5] text-[#2c1810] rounded-[8px] shadow-[0_2px_6px_rgba(44,24,16,0.05)]"
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
          className="w-auto min-w-[126px] bg-[#ffffff] border-[#e6e1d5] text-[#2c1810] rounded-[8px] shadow-[0_2px_6px_rgba(44,24,16,0.05)]"
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
        <ul className="bg-[#ffffff] rounded-[16px] border border-[#e6e1d5] divide-y divide-[#e6e1d5] overflow-hidden shadow-[0_12px_32px_-8px_rgba(224,86,56,0.12)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {visible.slice(0, 60).map((m) => {
            const student = studentOf(m.studentId);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setOpen(m)}
                  className="w-full text-left px-4.5 py-3.5 hover:bg-[#f8f6f0] transition-colors flex gap-3.5 items-start"
                >
                  <span className="w-8.5 h-8.5 mt-0.5 shrink-0 rounded-full bg-[#f8f6f0] border border-[#e6e1d5] text-[#e05638] flex items-center justify-center text-[11px] font-bold shadow-[inset_0_2px_4px_rgba(44,24,16,0.03)]">
                    {student ? initials(student.name) : "—"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[14px] font-semibold text-[#2c1810]">
                        {student?.name ?? "Removed student"}
                      </span>
                      <span className="tabular text-[12px] text-[#2c1810]/50">
                        {dateTime(m.sentAt ?? m.scheduledAt)}
                      </span>
                      <span className="text-[12px] text-[#2c1810]/50">
                        {nudgeOf(m.nudgeId)?.name ?? "One-off"}
                      </span>
                    </span>
                    <span
                      className={cx(
                        "block text-[13px] leading-relaxed line-clamp-2",
                        m.status === "failed" ? "text-[#dc2626]" : "text-[#2c1810]/75",
                      )}
                    >
                      {m.status === "failed" ? m.error : m.text}
                    </span>
                  </span>
                  <span className="shrink-0 flex items-center gap-1.5">
                    {m.status === "sending" ? (
                      <iconify-icon icon="line-md:loading-loop" style={{ fontSize: '16px', color: '#f59e0b' }}></iconify-icon>
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
        <p className="mt-4.5 text-[13px] text-[#2c1810]/60 text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
              className="bg-[#e05638] hover:bg-[#e05638]/90 text-white rounded-[8px] px-4 py-2 font-medium"
            >
              Send again
            </Button>
          ) : null
        }
      >
        {open ? (
          <div className="space-y-5.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div className="flex items-center gap-3.5">
              <span className="w-9.5 h-9.5 shrink-0 rounded-full bg-[#f8f6f0] border border-[#e6e1d5] text-[#e05638] flex items-center justify-center text-[12.5px] font-bold shadow-[inset_0_2px_4px_rgba(44,24,16,0.03)]">
                {studentOf(open.studentId)
                  ? initials(studentOf(open.studentId)!.name)
                  : "—"}
              </span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold text-[#2c1810]">
                  {studentOf(open.studentId)?.name ?? "Removed student"}
                </p>
                <p className="tabular text-[12px] text-[#2c1810]/50">
                  {studentOf(open.studentId)?.telegram ?? "no handle"}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                {open.status === "sending" ? (
                  <iconify-icon icon="line-md:loading-loop" style={{ fontSize: '18px', color: '#f59e0b' }}></iconify-icon>
                ) : open.status === "sent" ? (
                  <iconify-icon icon="line-md:confirm-circle" style={{ fontSize: '18px', color: '#10b981' }}></iconify-icon>
                ) : open.status === "failed" ? (
                  <iconify-icon icon="line-md:close-circle" style={{ fontSize: '18px', color: '#dc2626' }}></iconify-icon>
                ) : null}
                <Badge tone={STATUS_TONE[open.status]}>
                  {STATUS_LABEL[open.status]}
                </Badge>
              </div>
            </div>

            <div>
              <span className="label block mb-2 text-[12px] font-bold uppercase tracking-wider text-[#2c1810]/60">Message</span>
              <p className="text-[14px] leading-relaxed bg-[#f8f6f0] border border-[#e6e1d5] text-[#2c1810] rounded-[16px] rounded-tl-[8px] px-4.5 py-3.5 shadow-[inset_0_2px_4px_rgba(44,24,16,0.03)]">
                {open.text}
              </p>
            </div>

            {open.status === "queued" && !db.settings.telegramConnected ? (
              <div>
                <span className="label block mb-2 text-[12px] font-bold uppercase tracking-wider text-[#2c1810]/60">Why it is waiting</span>
                <div className="flex items-start gap-2.5 text-[#2c1810] bg-[#ffffff] border border-dashed border-[#e6e1d5] rounded-[16px] p-3.5 leading-relaxed shadow-[inset_0_2px_4px_rgba(44,24,16,0.03)]">
                  <iconify-icon icon="svg-spinners:ring-resize" style={{ fontSize: '18px', color: '#f59e0b', marginTop: '2px', flexShrink: 0 }}></iconify-icon>
                  <p className="text-[13.5px] text-[#2c1810]/80">
                    No Telegram account is connected, so nothing leaves the app yet.
                    Connect one in Settings.
                  </p>
                </div>
              </div>
            ) : null}

            {open.status === "failed" ? (
              <div>
                <span className="label block mb-2 text-[12px] font-bold uppercase tracking-wider text-[#dc2626]">Why it failed</span>
                <p className="text-[13.5px] text-[#dc2626] bg-[#dc2626]/5 border border-[#dc2626]/20 rounded-[8px] px-3.5 py-2.5">
                  {open.error}
                </p>
              </div>
            ) : null}

            <dl className="text-[13px] divide-y divide-[#e6e1d5] border-t border-[#e6e1d5]">
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
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-[#2c1810]/60">{label}</dt>
      <dd className={mono ? "tabular text-[12.5px] text-[#2c1810] font-mono" : "text-[#2c1810]"}>{value}</dd>
    </div>
  );
}