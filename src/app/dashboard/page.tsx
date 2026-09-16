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
        <div className="flex flex-col items-center justify-center py-16 gap-5 font-['Inter']">
          <div className="p-8 rounded-[10px] border-2 border-[#111114] bg-[#F4F4F6] shadow-[0_4px_0_#111114] flex flex-col items-center gap-4">
            <iconify-icon icon="line-md:loading-loop" style={{ fontSize: "40px", color: "#FF4B2B" }}></iconify-icon>
            <span className="text-[15px] font-bold text-[#111114] font-['Space_Grotesk']">Loading dashboard...</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-[#F4F4F6] rounded-[10px] p-6 border-2 border-[#111114] shadow-[0_4px_0_#111114]">
                <Skeleton className="h-10 w-20 rounded-[4px] bg-[#111114]/10" />
                <Skeleton className="h-4 w-28 mt-4 rounded-[4px] bg-[#111114]/10" />
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
        <div className="flex gap-3">
          <script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js"></script>
          <script src="https://unpkg.com/@lottiefiles/lottie-player@2.0.4/dist/lottie-player.js"></script>
          <Link href="/nudges/new">
            <Button className="rounded-[6px] bg-[#FFFFFF] text-[#111114] border-2 border-[#111114] shadow-[0_4px_0_#111114] hover:bg-[#F4F4F6] font-['Space_Grotesk'] font-bold transition-all active:translate-y-1 active:shadow-none">New nudge</Button>
          </Link>
          <Link href="/send">
            <Button variant="primary" className="rounded-[6px] bg-[#FF4B2B] text-white border-2 border-[#111114] shadow-[0_4px_0_#111114] hover:bg-[#FF4B2B]/90 font-['Space_Grotesk'] font-bold transition-all active:translate-y-1 active:shadow-none">Send now</Button>
          </Link>
        </div>
      }
    >
      <ExamAlerts />

      {/* Stats — numbers as data, styled cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat value={active.length} label="Active students" />
        <Stat value={sentThisWeek.length} label="Sent this week" />
        <Stat value={queued.length} label="Queued tonight" />
        <Stat
          value={quiet.length}
          label="Gone quiet / Unpaid alert"
          tone={quiet.length > 0 ? "clay" : "neutral"}
          showAlertIcon={quiet.length > 0}
        />
      </section>

      {/* Money — financial summary block */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[14px] font-bold tracking-wider uppercase text-[#111114] font-['Space_Grotesk']">Last 30 days</h2>
          <span className="text-[13px] text-[#111114]/70 font-['Inter'] font-medium">
            {finance.mixed
              ? `${finance.primary} only — ask the assistant for the rest`
              : "ask the assistant to add income or an expense"}
          </span>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-[#F4F4F6] border-2 border-[#111114] rounded-[10px] p-6 shadow-[0_4px_0_#111114]">
            <p className="text-[32px] font-bold text-[#0B8F5C] font-['Space_Grotesk'] leading-tight">
              {money(totals.income, finance.primary)}
            </p>
            <p className="text-[12px] font-bold tracking-wider uppercase text-[#111114]/80 mt-2 font-['Space_Grotesk']">In (Collected Fees)</p>
          </div>
          <div className="bg-[#F4F4F6] border-2 border-[#111114] rounded-[10px] p-6 shadow-[0_4px_0_#111114]">
            <p className="text-[32px] font-bold text-[#E3341F] font-['Space_Grotesk'] leading-tight">
              {money(totals.expense, finance.primary)}
            </p>
            <p className="text-[12px] font-bold tracking-wider uppercase text-[#111114]/80 mt-2 font-['Space_Grotesk']">Out</p>
          </div>
          <div className="bg-[#F4F4F6] border-2 border-[#111114] rounded-[10px] p-6 shadow-[0_4px_0_#111114]">
            <p
              className={`text-[32px] font-bold font-['Space_Grotesk'] leading-tight ${totals.net >= 0 ? "text-[#FF4B2B]" : "text-[#E3341F]"}`}
            >
              {money(totals.net, finance.primary)}
            </p>
            <p className="text-[12px] font-bold tracking-wider uppercase text-[#111114]/80 mt-2 font-['Space_Grotesk']">Net Balance</p>
          </div>
        </div>
      </section>

      {/* The week — week strip section */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[14px] font-bold tracking-wider uppercase text-[#111114] font-['Space_Grotesk']">This week</h2>
          <span className="text-[13px] text-[#111114]/70 font-['Inter'] font-medium">
            {scheduledDays.length} of 7 days have a nudge
          </span>
        </div>
        <div className="bg-[#F4F4F6] rounded-[10px] p-6 border-2 border-[#111114] shadow-[0_4px_0_#111114]">
          <WeekStrip active={scheduledDays} size="lg" label="Days with a nudge" />
          <p className="mt-5 text-[14px] text-[#111114] font-['Inter'] font-medium">
            Today is{" "}
            <span className="text-[#111114] font-bold underline decoration-[#FF4B2B] decoration-2">
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][today]}
            </span>
            {scheduledDays.includes(today)
              ? " — a nudge goes out."
              : " — nothing scheduled."}
          </p>
        </div>
      </section>

      <div className="mt-12 grid lg:grid-cols-2 gap-8">
        {/* Gone quiet / Unpaid Alert */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-bold tracking-wider uppercase text-[#111114] font-['Space_Grotesk']">Gone quiet / Unpaid</h2>
              {quiet.length > 0 && (
                <iconify-icon icon="line-md:bell-loop" style={{ fontSize: "20px", color: "#E3341F" }}></iconify-icon>
              )}
            </div>
            <Link
              href="/students"
              className="text-[13px] font-bold text-[#FF4B2B] hover:underline font-['Space_Grotesk']"
            >
              All students
            </Link>
          </div>
          {quiet.length === 0 ? (
            <div className="bg-[#F4F4F6] rounded-[10px] p-8 text-center border-2 border-[#111114] shadow-[0_4px_0_#111114] flex flex-col items-center justify-center gap-2">
              <iconify-icon icon="line-md:confirm-circle" style={{ fontSize: "36px", color: "#0B8F5C" }}></iconify-icon>
              <p className="text-[14px] font-medium text-[#111114] font-['Inter']">Everyone has heard from you this week & fees are up to date.</p>
            </div>
          ) : (
            <ul className="bg-[#FFFFFF] rounded-[10px] border-2 border-[#111114] divide-y-2 divide-[#111114] shadow-[0_4px_0_#111114] overflow-hidden">
              {quiet.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center gap-4 px-5 py-4 bg-[#F4F4F6]/50 hover:bg-[#F4F4F6]">
                  <Avatar name={s.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-[#111114] truncate font-['Space_Grotesk']">{s.name}</p>
                    <p className="text-[12px] text-[#111114]/70 truncate font-['Inter']">
                      {groupNameOf(s, db.groups)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <iconify-icon icon="line-md:close-circle" style={{ fontSize: "18px", color: "#E3341F" }}></iconify-icon>
                    <span className="tabular text-[12px] font-bold text-[#E3341F] bg-[#E3341F]/10 border border-[#E3341F] px-2 py-0.5 rounded-[4px] font-['Space_Grotesk']">
                      {since(s.lastContactedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Going out tonight */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[14px] font-bold tracking-wider uppercase text-[#111114] font-['Space_Grotesk']">Going out tonight</h2>
            <Link
              href="/messages"
              className="text-[13px] font-bold text-[#FF4B2B] hover:underline font-['Space_Grotesk']"
            >
              All messages
            </Link>
          </div>
          {queued.length === 0 ? (
            <div className="bg-[#F4F4F6] rounded-[10px] p-8 text-center border-2 border-[#111114] shadow-[0_4px_0_#111114]">
              <p className="text-[14px] font-medium text-[#111114] font-['Inter']">Nothing queued.</p>
            </div>
          ) : (
            <ul className="bg-[#FFFFFF] rounded-[10px] border-2 border-[#111114] divide-y-2 divide-[#111114] shadow-[0_4px_0_#111114] overflow-hidden">
              {queued.slice(0, 5).map((m) => (
                <li key={m.id} className="px-5 py-4 bg-[#F4F4F6]/50 hover:bg-[#F4F4F6]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-bold text-[#111114] font-['Space_Grotesk']">
                      {nameOf(m.studentId)}
                    </span>
                    <span className="tabular text-[12px] font-semibold text-[#111114]/70 bg-[#111114]/5 px-2 py-0.5 rounded-[4px] font-['Space_Grotesk']">
                      {time(
                        new Date(m.scheduledAt).getHours(),
                        new Date(m.scheduledAt).getMinutes(),
                      )}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#111114]/80 line-clamp-2 leading-relaxed font-['Inter']">
                    {m.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Nudges at a glance */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[14px] font-bold tracking-wider uppercase text-[#111114] font-['Space_Grotesk']">Your nudges</h2>
          <Link
            href="/nudges"
            className="text-[13px] font-bold text-[#FF4B2B] hover:underline inline-flex items-center gap-1 font-['Space_Grotesk']"
          >
            Manage <IconArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <ul className="bg-[#FFFFFF] rounded-[10px] border-2 border-[#111114] divide-y-2 divide-[#111114] shadow-[0_4px_0_#111114] overflow-hidden">
          {nudges.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 bg-[#F4F4F6]/40 hover:bg-[#F4F4F6]"
            >
              <span className="text-[15px] font-bold text-[#111114] flex-1 min-w-[140px] font-['Space_Grotesk']">
                {n.name}
              </span>
              <WeekStrip active={n.days} size="sm" tone="quiet" />
              <span className="tabular text-[13px] font-semibold text-[#111114]/80 w-[48px] font-['Space_Grotesk']">
                {time(n.hour, n.minute)}
              </span>
              <span className="text-[13px] font-medium text-[#111114]/70 hidden sm:inline w-[124px] truncate font-['Inter']">
                {audienceOf(n.audience, students).length} recipients
              </span>
              <Badge tone={n.status === "active" ? "accent" : "quiet"} className="rounded-[4px] border border-[#111114] font-['Space_Grotesk'] font-bold">
                {n.status === "active" ? "Active" : "Paused"}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      {/* Recent activity */}
      <section className="mt-12">
        <h2 className="text-[14px] font-bold tracking-wider uppercase text-[#111114] mb-4 font-['Space_Grotesk']">Recent</h2>
        <ul className="space-y-3">
          {recent.map((m) => (
            <li key={m.id} className="flex items-baseline gap-4 text-[14px] bg-[#F4F4F6] border-2 border-[#111114] p-3 rounded-[6px] shadow-[0_2px_0_#111114] font-['Inter']">
              <span className="tabular text-[12px] font-bold text-[#111114]/70 w-[100px] shrink-0 font-['Space_Grotesk']">
                {dateTime(m.sentAt ?? m.scheduledAt)}
              </span>
              <span className="font-bold text-[#111114] shrink-0 font-['Space_Grotesk']">{nameOf(m.studentId)}</span>
              {m.status === "failed" ? (
                <span className="text-[#E3341F] text-[13px] font-bold font-['Space_Grotesk'] flex items-center gap-1">
                  <iconify-icon icon="line-md:close-circle" style={{ fontSize: "16px" }}></iconify-icon>
                  {m.error}
                </span>
              ) : (
                <span className="text-[#111114]/80 truncate font-medium">{m.text}</span>
              )}
            </li>
          ))}
        </ul>
        {failedThisWeek.length > 0 ? (
          <div className="mt-5 p-4 bg-[#E3341F]/10 border-2 border-[#E3341F] rounded-[8px] flex items-center gap-3">
            <iconify-icon icon="line-md:close-circle" style={{ fontSize: "24px", color: "#E3341F" }}></iconify-icon>
            <p className="text-[14px] text-[#E3341F] font-bold font-['Space_Grotesk']">
              {failedThisWeek.length} message
              {failedThisWeek.length === 1 ? "" : "s"} failed this week. Open Messages to see why.
            </p>
          </div>
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
  showAlertIcon = false,
}: {
  value: number;
  label: string;
  tone?: "neutral" | "clay";
  showAlertIcon?: boolean;
}) {
  return (
    <div className={`rounded-[10px] p-6 border-2 border-[#111114] shadow-[0_4px_0_#111114] relative overflow-hidden ${
      tone === "clay" && value > 0 ? "bg-[#E3341F]/10 border-[#E3341F]" : "bg-[#F4F4F6]"
    }`}>
      {showAlertIcon && (
        <div className="absolute top-3 right-3 animate-pulse">
          <iconify-icon icon="line-md:bell-loop" style={{ fontSize: "24px", color: "#E3341F" }}></iconify-icon>
        </div>
      )}
      <p
        className={`text-[44px] font-extrabold leading-none font-['Space_Grotesk'] ${
          tone === "clay" && value > 0 ? "text-[#E3341F]" : "text-[#111114]"
        }`}
      >
        {value}
      </p>
      <p className="text-[12px] font-bold tracking-wider uppercase text-[#111114] mt-4 font-['Space_Grotesk']">{label}</p>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="w-9 h-9 shrink-0 rounded-[6px] bg-[#FFFFFF] border-2 border-[#111114] flex items-center justify-center text-[12px] font-bold text-[#111114] shadow-[0_2px_0_#111114] font-['Space_Grotesk']">
      {initials(name)}
    </span>
  );
}