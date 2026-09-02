"use client";

import Link from "next/link";
import { Page } from "@/components/AppShell";
import { WeekStrip } from "@/components/WeekStrip";
import { Badge, Button, Skeleton } from "@/components/ui";
import { IconArrowRight } from "@/components/icons";
import { useStore } from "@/lib/store/StoreProvider";
import {
  audienceOf,
  dateTime,
  groupNameOf,
  initials,
  since,
  time,
  weekdayIndex,
} from "@/lib/format";

const STALE_AFTER_DAYS = 7;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { db, ready } = useStore();
  const { students, nudges, messages, settings } = db;

  const active = students.filter((s) => s.status === "active");

  const weekAgo = Date.now() - 7 * 86_400_000;
  const sentThisWeek = messages.filter(
    (m) => m.status === "sent" && m.sentAt && new Date(m.sentAt).getTime() > weekAgo,
  );
  const queued = messages.filter((m) => m.status === "queued");
  const failedThisWeek = messages.filter(
    (m) =>
      m.status === "failed" && new Date(m.scheduledAt).getTime() > weekAgo,
  );

  // The students the agent would flag: active, but silent for over a week.
  const quiet = active
    .filter((s) => {
      if (!s.lastContactedAt) return true;
      return Date.now() - new Date(s.lastContactedAt).getTime() > STALE_AFTER_DAYS * 86_400_000;
    })
    .sort((a, b) => {
      const at = a.lastContactedAt ? new Date(a.lastContactedAt).getTime() : 0;
      const bt = b.lastContactedAt ? new Date(b.lastContactedAt).getTime() : 0;
      return at - bt;
    });

  // Which weekdays have at least one active nudge firing.
  const scheduledDays = Array.from(
    new Set(nudges.filter((n) => n.status === "active").flatMap((n) => n.days)),
  );
  const today = weekdayIndex(new Date());

  const recent = [...messages]
    .filter((m) => m.status !== "queued")
    .sort(
      (a, b) =>
        new Date(b.sentAt ?? b.scheduledAt).getTime() -
        new Date(a.sentAt ?? a.scheduledAt).getTime(),
    )
    .slice(0, 6);

  const nameOf = (id: string) =>
    students.find((s) => s.id === id)?.name ?? "Removed student";

  if (!ready) {
    return (
      <Page title="Today">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card p-5">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-3 w-24 mt-3" />
            </div>
          ))}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title={
        settings.teacherName
          ? `${greeting()}, ${settings.teacherName}`
          : greeting()
      }
      subtitle={
        settings.telegramConnected
          ? "Your nudges are running."
          : "Nothing is sending yet — connect Telegram in Settings."
      }
      action={
        <div className="flex gap-2">
          <Link href="/nudges/new">
            <Button>New nudge</Button>
          </Link>
          <Link href="/send">
            <Button variant="primary">Send now</Button>
          </Link>
        </div>
      }
    >
      {/* Stats — numbers as data, no boxes, no icons. */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat value={active.length} label="Active students" />
        <Stat value={sentThisWeek.length} label="Sent this week" />
        <Stat value={queued.length} label="Queued tonight" />
        <Stat
          value={quiet.length}
          label="Gone quiet"
          tone={quiet.length > 0 ? "clay" : "neutral"}
        />
      </section>

      {/* The week — the signature object, at full size. */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="label">This week</h2>
          <span className="text-[12px] text-faint">
            {scheduledDays.length} of 7 days have a nudge
          </span>
        </div>
        <div className="card p-5">
          <WeekStrip active={scheduledDays} size="lg" label="Days with a nudge" />
          <p className="mt-3.5 text-[13px] text-muted">
            Today is{" "}
            <span className="text-ink font-medium">
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][today]}
            </span>
            {scheduledDays.includes(today)
              ? " — a nudge goes out."
              : " — nothing scheduled."}
          </p>
        </div>
      </section>

      <div className="mt-10 grid lg:grid-cols-2 gap-10">
        {/* Gone quiet — the reason the product exists. */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="label">Gone quiet</h2>
            <Link
              href="/students"
              className="text-[12px] text-accent hover:text-forest"
            >
              All students
            </Link>
          </div>
          {quiet.length === 0 ? (
            <div className="card px-5 py-8 text-center">
              <p className="text-[13.5px]">Everyone has heard from you this week.</p>
            </div>
          ) : (
            <ul className="card divide-y divide-line">
              {quiet.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={s.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium truncate">{s.name}</p>
                    <p className="text-[12px] text-faint truncate">
                      {groupNameOf(s, db.groups)}
                    </p>
                  </div>
                  <span className="tabular text-[12px] text-clay shrink-0">
                    {since(s.lastContactedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Going out tonight */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="label">Going out tonight</h2>
            <Link
              href="/messages"
              className="text-[12px] text-accent hover:text-forest"
            >
              All messages
            </Link>
          </div>
          {queued.length === 0 ? (
            <div className="card px-5 py-8 text-center">
              <p className="text-[13.5px]">Nothing queued.</p>
            </div>
          ) : (
            <ul className="card divide-y divide-line">
              {queued.slice(0, 5).map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13.5px] font-medium">
                      {nameOf(m.studentId)}
                    </span>
                    <span className="tabular text-[12px] text-faint">
                      {time(
                        new Date(m.scheduledAt).getHours(),
                        new Date(m.scheduledAt).getMinutes(),
                      )}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-muted line-clamp-2 leading-snug">
                    {m.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Nudges at a glance */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="label">Your nudges</h2>
          <Link
            href="/nudges"
            className="text-[12px] text-accent hover:text-forest inline-flex items-center gap-1"
          >
            Manage <IconArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <ul className="card divide-y divide-line">
          {nudges.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5"
            >
              <span className="text-[13.5px] font-medium flex-1 min-w-[140px]">
                {n.name}
              </span>
              <WeekStrip active={n.days} size="sm" tone="quiet" />
              <span className="tabular text-[12.5px] text-muted w-[42px]">
                {time(n.hour, n.minute)}
              </span>
              <span className="text-[12.5px] text-faint hidden sm:inline w-[120px] truncate">
                {audienceOf(n.audience, students).length} recipients
              </span>
              <Badge tone={n.status === "active" ? "accent" : "quiet"}>
                {n.status === "active" ? "Active" : "Paused"}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      {/* Recent activity */}
      <section className="mt-10">
        <h2 className="label mb-3">Recent</h2>
        <ul className="space-y-2.5">
          {recent.map((m) => (
            <li key={m.id} className="flex items-baseline gap-3 text-[13px]">
              <span className="tabular text-[12px] text-faint w-[92px] shrink-0">
                {dateTime(m.sentAt ?? m.scheduledAt)}
              </span>
              <span className="font-medium shrink-0">{nameOf(m.studentId)}</span>
              {m.status === "failed" ? (
                <span className="text-clay text-[12.5px]">{m.error}</span>
              ) : (
                <span className="text-muted truncate">{m.text}</span>
              )}
            </li>
          ))}
        </ul>
        {failedThisWeek.length > 0 ? (
          <p className="mt-4 text-[12.5px] text-clay">
            {failedThisWeek.length} message
            {failedThisWeek.length === 1 ? "" : "s"} failed this week. Open Messages to
            see why.
          </p>
        ) : null}
      </section>
    </Page>
  );
}

function Stat({
  value,
  label,
  tone = "neutral",
}: {
  value: number;
  label: string;
  tone?: "neutral" | "clay";
}) {
  return (
    <div className="card px-5 py-6">
      <p
        className={`figure text-[38px] ${
          tone === "clay" && value > 0 ? "text-clay" : "text-forest"
        }`}
      >
        {value}
      </p>
      <p className="label mt-3">{label}</p>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="w-8 h-8 shrink-0 rounded-full bg-shell border border-line flex items-center justify-center text-[11px] font-semibold text-muted">
      {initials(name)}
    </span>
  );
}
