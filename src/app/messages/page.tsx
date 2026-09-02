"use client";

import { useMemo, useState } from "react";
import { Page } from "@/components/AppShell";
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
      {!db.settings.telegramConnected && counts.queued > 0 ? (
        <div className="card-mint p-5 mb-5">
          <p className="text-[14px] font-bold text-forest">
            {counts.queued} message{counts.queued === 1 ? "" : "s"} waiting to go
            out
          </p>
          <p className="text-[13px] text-forest/75 mt-1.5 leading-relaxed">
            They stay queued because no Telegram account is connected. Connect one
            in Settings and anything due is sent within a few seconds.
          </p>
          <Link href="/settings">
            <Button variant="primary" className="mt-4">
              Connect Telegram
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student or message text"
            className="pl-9"
            aria-label="Search messages"
          />
        </div>
        <Select
          value={nudgeId}
          onChange={(e) => setNudgeId(e.target.value)}
          aria-label="Filter by nudge"
          className="w-auto min-w-[170px]"
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
          className="w-auto min-w-[120px]"
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
        <ul className="card divide-y divide-line overflow-hidden">
          {visible.slice(0, 60).map((m) => {
            const student = studentOf(m.studentId);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setOpen(m)}
                  className="w-full text-left px-4 py-3.5 hover:bg-field/60 transition-colors flex gap-3"
                >
                  <span className="w-8 h-8 mt-0.5 shrink-0 rounded-full bg-mint text-forest flex items-center justify-center text-[11px] font-bold">
                    {student ? initials(student.name) : "—"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[13.5px] font-medium">
                        {student?.name ?? "Removed student"}
                      </span>
                      <span className="tabular text-[11.5px] text-faint">
                        {dateTime(m.sentAt ?? m.scheduledAt)}
                      </span>
                      <span className="text-[11.5px] text-faint">
                        {nudgeOf(m.nudgeId)?.name ?? "One-off"}
                      </span>
                    </span>
                    <span
                      className={cx(
                        "block text-[13px] leading-snug line-clamp-2",
                        m.status === "failed" ? "text-clay" : "text-muted",
                      )}
                    >
                      {m.status === "failed" ? m.error : m.text}
                    </span>
                  </span>
                  <span className="shrink-0">
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
        <p className="mt-4 text-[12.5px] text-faint text-center">
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
                updateMessage(open.id, {
                  status: "queued",
                  error: undefined,
                  scheduledAt: new Date().toISOString(),
                });
                setOpen(null);
              }}
            >
              Send again
            </Button>
          ) : null
        }
      >
        {open ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 shrink-0 rounded-full bg-mint text-forest flex items-center justify-center text-[12px] font-bold">
                {studentOf(open.studentId)
                  ? initials(studentOf(open.studentId)!.name)
                  : "—"}
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-medium">
                  {studentOf(open.studentId)?.name ?? "Removed student"}
                </p>
                <p className="tabular text-[12px] text-faint">
                  {studentOf(open.studentId)?.telegram ?? "no handle"}
                </p>
              </div>
              <div className="ml-auto">
                <Badge tone={STATUS_TONE[open.status]}>
                  {STATUS_LABEL[open.status]}
                </Badge>
              </div>
            </div>

            <div>
              <span className="label block mb-2">Message</span>
              <p className="text-[14px] leading-relaxed bg-mint rounded-[10px] rounded-tl-[3px] px-4 py-3">
                {open.text}
              </p>
            </div>

            {open.status === "queued" && !db.settings.telegramConnected ? (
              <div>
                <span className="label block mb-2">Why it is waiting</span>
                <p className="text-[13.5px] text-forest bg-mint rounded-[16px] px-3.5 py-2.5 leading-relaxed">
                  No Telegram account is connected, so nothing leaves the app yet.
                  Connect one in Settings.
                </p>
              </div>
            ) : null}

            {open.status === "failed" ? (
              <div>
                <span className="label block mb-2">Why it failed</span>
                <p className="text-[13.5px] text-clay bg-clay-soft border border-clay/15 rounded-[8px] px-3.5 py-2.5">
                  {open.error}
                </p>
              </div>
            ) : null}

            <dl className="text-[13px] divide-y divide-line border-t border-line">
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
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "tabular text-[12.5px]" : undefined}>{value}</dd>
    </div>
  );
}
