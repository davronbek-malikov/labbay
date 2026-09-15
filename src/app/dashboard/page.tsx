"use client";

import Link from "next/link";
import { Page } from "@/components/AppShell";
import { WeekStrip } from "@/components/WeekStrip";
import { ExamAlerts } from "@/components/ExamAlerts";
import { Badge, Button, Skeleton } from "@/components/ui";
import { IconArrowRight } from "@/components/icons";
import { useStore } from "@/lib/store/StoreProvider";
import {
  audienceOf,
  financeSummary,
  money,
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

  const finance = financeSummary(db, 30);
  const totals = finance.byCurrency[finance.primary] ?? {
    income: 0,
    expense: 0,
    net: 0,
    feeIncome: 0,
  };

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
        <script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js"></script>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="p-6 rounded-[16px] border border-dashed border-[#e6e1d5] bg-white shadow-[inset_0_2px_4px_rgba(44,24,16,0.06)] flex flex-col items-center gap-3">
            <iconify-icon icon="line-md:loading-loop" style={{ fontSize: "36px", color: "#e05638" }}></iconify-icon>
            <span className="text-[14px] font-medium text-[#2c1810]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Loading dashboard...</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 w-full">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[16px] p-5 border border-[#e6e1d5] shadow-[0_2px_6px_rgba(44,24,16,0.05)]">
                <Skeleton className="h-9 w-16 rounded-[8px]" />
                <Skeleton className="h-3 w-24 mt-3 rounded-[8px]" />
              </div>
            ))}
          </div>
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
        <div className="flex gap-2.5">
          <Link href="/nudges/new">
            <Button className="rounded-[8px] bg-white text-[#2c1810] border border-[#e6e1d5] shadow-[0_2px_6px_rgba(44,24,16,0.05)] hover:bg-[#f8f6f0]">New nudge</Button>
          </Link>
          <Link href="/send">
            <Button variant="primary" className="rounded-[8px] bg-[#e05638] text-white shadow-[0_12px_32px_-8px_rgba(224,86,56,0.12)] hover:bg-[#c9492d]">Send now</Button>
          </Link>
        </div>
      }
    >
      <ExamAlerts />

      {/* Stats — numbers as data, styled cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Stat value={active.length} label="Active students" />
        <Stat value={sentThisWeek.length} label="Sent this week" />
        <Stat value={queued.length} label="Queued tonight" />
        <Stat
          value={quiet.length}
          label="Gone quiet"
          tone={quiet.length > 0 ? "clay" : "neutral"}
        />
      </section>

      {/* Money — financial summary block */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between mb-3.5">
          <h2 className="text-[13px] font-semibold tracking-wider uppercase text-[#2c1810]/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Last 30 days</h2>
          <span className="text-[12px] text-[#2c1810]/50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {finance.mixed
              ? `${finance.primary} only — ask the assistant for the rest`
              : "ask the assistant to add income or an expense"}
          </span>
        </div>
        <div className="grid sm:grid-cols-3 gap-px bg-[#e6e1d5] border border-[#e6e1d5] rounded-[16px] overflow-hidden shadow-[0_2px_6px_rgba(44,24,16,0.05)]">
          <div className="bg-white px-5 py-5.5 shadow-[inset_0_2px_4px_rgba(44,24,16,0.02)]">
            <p className="text-[26px] font-bold text-[#10b981]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {money(totals.income, finance.primary)}
            </p>
            <p className="text-[12px] font-semibold tracking-wider uppercase text-[#2c1810]/60 mt-2">In</p>
          </div>
          <div className="bg-white px-5 py-5.5 shadow-[inset_0_2px_4px_rgba(44,24,16,0.02)]">
            <p className="text-[26px] font-bold text-[#dc2626]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {money(totals.expense, finance.primary)}
            </p>
            <p className="text-[12px] font-semibold tracking-wider uppercase text-[#2c1810]/60 mt-2">Out</p>
          </div>
          <div className="bg-white px-5 py-5.5 shadow-[inset_0_2px_4px_rgba(44,24,16,0.02)]">
            <p
              className={`text-[26px] font-bold ${totals.net >= 0 ? "text-[#e05638]" : "text-[#dc2626]"}`}
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {money(totals.net, finance.primary)}
            </p>
            <p className="text-[12px] font-semibold tracking-wider uppercase text-[#2c1810]/60 mt-2">Net</p>
          </div>
        </div>
      </section>

      {/* The week — week strip section */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between mb-3.5">
          <h2 className="text-[13px] font-semibold tracking-wider uppercase text-[#2c1810]/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>This week</h2>
          <span className="text-[12px] text-[#2c1810]/50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {scheduledDays.length} of 7 days have a nudge
          </span>
        </div>
        <div className="bg-white rounded-[16px] p-5.5 border border-[#e6e1d5] shadow-[0_2px_6px_rgba(44,24,16,0.05)]">
          <WeekStrip active={scheduledDays} size="lg" label="Days with a nudge" />
          <p className="mt-4 text-[13.5px] text-[#2c1810]/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Today is{" "}
            <span className="text-[#2c1810] font-semibold">
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][today]}
            </span>
            {scheduledDays.includes(today)
              ? " — a nudge goes out."
              : " — nothing scheduled."}
          </p>
        </div>
      </section>

      <div className="mt-10 grid lg:grid-cols-2 gap-10">
        {/* Gone quiet */}
        <section>
          <div className="flex items-baseline justify-between mb-3.5">
            <h2 className="text-[13px] font-semibold tracking-wider uppercase text-[#2c1810]/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Gone quiet</h2>
            <Link
              href="/students"
              className="text-[12px] font-medium text-[#e05638] hover:text-[#f59e0b]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              All students
            </Link>
          </div>
          {quiet.length === 0 ? (
            <div className="bg-white rounded-[16px] px-5 py-8 text-center border border-[#e6e1d5] shadow-[0_2px_6px_rgba(44,24,16,0.05)] shadow-[inset_0_2px_4px_rgba(44,24,16,0.03)]">
              <p className="text-[14px] text-[#2c1810]/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Everyone has heard from you this week.</p>
            </div>
          ) : (
            <ul className="bg-white rounded-[16px] border border-[#e6e1d5] divide-y divide-[#e6e1d5] shadow-[0_2px_6px_rgba(44,24,16,0.05)] overflow-hidden">
              {quiet.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center gap-3.5 px-4.5 py-3.5">
                  <Avatar name={s.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[#2c1810] truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.name}</p>
                    <p className="text-[12px] text-[#2c1810]/50 truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {groupNameOf(s, db.groups)}
                    </p>
                  </div>
                  <span className="tabular text-[12px] font-medium text-[#dc2626] shrink-0" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {since(s.lastContactedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Going out tonight */}
        <section>
          <div className="flex items-baseline justify-between mb-3.5">
            <h2 className="text-[13px] font-semibold tracking-wider uppercase text-[#2c1810]/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Going out tonight</h2>
            <Link
              href="/messages"
              className="text-[12px] font-medium text-[#e05638] hover:text-[#f59e0b]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              All messages
            </Link>
          </div>
          {queued.length === 0 ? (
            <div className="bg-white rounded-[16px] px-5 py-8 text-center border border-[#e6e1d5] shadow-[0_2px_6px_rgba(44,24,16,0.05)] shadow-[inset_0_2px_4px_rgba(44,24,16,0.03)]">
              <p className="text-[14px] text-[#2c1810]/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Nothing queued.</p>
            </div>
          ) : (
            <ul className="bg-white rounded-[16px] border border-[#e6e1d5] divide-y divide-[#e6e1d5] shadow-[0_2px_6px_rgba(44,24,16,0.05)] overflow-hidden">
              {queued.slice(0, 5).map((m) => (
                <li key={m.id} className="px-4.5 py-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-medium text-[#2c1810]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {nameOf(m.studentId)}
                    </span>
                    <span className="tabular text-[12px] text-[#2c1810]/50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {time(
                        new Date(m.scheduledAt).getHours(),
                        new Date(m.scheduledAt).getMinutes(),
                      )}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#2c1810]/70 line-clamp-2 leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
        <div className="flex items-baseline justify-between mb-3.5">
          <h2 className="text-[13px] font-semibold tracking-wider uppercase text-[#2c1810]/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Your nudges</h2>
          <Link
            href="/nudges"
            className="text-[12px] font-medium text-[#e05638] hover:text-[#f59e0b] inline-flex items-center gap-1"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Manage <IconArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <ul className="bg-white rounded-[16px] border border-[#e6e1d5] divide-y divide-[#e6e1d5] shadow-[0_2px_6px_rgba(44,24,16,0.05)] overflow-hidden">
          {nudges.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4.5 py-4"
            >
              <span className="text-[14px] font-medium text-[#2c1810] flex-1 min-w-[140px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {n.name}
              </span>
              <WeekStrip active={n.days} size="sm" tone="quiet" />
              <span className="tabular text-[13px] text-[#2c1810]/70 w-[44px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {time(n.hour, n.minute)}
              </span>
              <span className="text-[13px] text-[#2c1810]/50 hidden sm:inline w-[124px] truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {audienceOf(n.audience, students).length} recipients
              </span>
              <Badge tone={n.status === "active" ? "accent" : "quiet"} className="rounded-[8px]">
                {n.status === "active" ? "Active" : "Paused"}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      {/* Recent activity */}
      <section className="mt-10">
        <h2 className="text-[13px] font-semibold tracking-wider uppercase text-[#2c1810]/70 mb-3.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Recent</h2>
        <ul className="space-y-3">
          {recent.map((m) => (
            <li key={m.id} className="flex items-baseline gap-3 text-[13.5px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <span className="tabular text-[12px] text-[#2c1810]/50 w-[96px] shrink-0">
                {dateTime(m.sentAt ?? m.scheduledAt)}
              </span>
              <span className="font-semibold text-[#2c1810] shrink-0">{nameOf(m.studentId)}</span>
              {m.status === "failed" ? (
                <span className="text-[#dc2626] text-[13px] font-medium">{m.error}</span>
              ) : (
                <span className="text-[#2c1810]/70 truncate">{m.text}</span>
              )}
            </li>
          ))}
        </ul>
        {failedThisWeek.length > 0 ? (
          <p className="mt-4.5 text-[13px] text-[#dc2626] font-medium" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {failedThisWeek.length} message
            {failedThisWeek.length === 1 ? "" : "s"} failed this week. Open Messages to
            see why.
          </p>
        ) : null}
      </section>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('click', function(e) {
              const target = e.target.closest('button, a, input, [role="button"]');
              if (target) {
                new Audio('https://cdn.jsdelivr.net/npm/uisfx@0.4.0/sounds/minimal/press.mp3').play().catch(() => {});
              }
            });
          `,
        }}
      />
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
    <div className="bg-white rounded-[16px] px-5 py-6 border border-[#e6e1d5] shadow-[0_2px_6px_rgba(44,24,16,0.05)] shadow-[inset_0_2px_4px_rgba(44,24,16,0.02)]">
      <p
        className={`text-[40px] font-extrabold leading-none ${
          tone === "clay" && value > 0 ? "text-[#dc2626]" : "text-[#e05638]"
        }`}
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {value}
      </p>
      <p className="text-[12px] font-semibold tracking-wider uppercase text-[#2c1810]/60 mt-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</p>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="w-8.5 h-8.5 shrink-0 rounded-full bg-[#f8f6f0] border border-[#e6e1d5] flex items-center justify-center text-[11px] font-bold text-[#2c1810]/70 shadow-[inset_0_1px_2px_rgba(44,24,16,0.05)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {initials(name)}
    </span>
  );
}