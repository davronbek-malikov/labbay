"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import {
  IconArrowLeft,
  IconAssistant,
  IconDashboard,
  IconMessages,
  IconNudges,
  IconSend,
  IconSettings,
  IconStudents,
} from "@/components/icons";
import { useStore } from "@/lib/store/StoreProvider";
import { AuthScreen, Splash } from "@/components/AuthScreen";

/**
 * Four entries, and that is the whole app.
 *
 * Sending, nudges and message history all belong to students, so they sit
 * behind the Students entry rather than crowding the sidebar.
 */
const NAV = [
  { href: "/assistant", label: "Assistant", Icon: IconAssistant },
  { href: "/courses", label: "Courses", Icon: IconNudges },
  { href: "/students", label: "Students", Icon: IconStudents },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

/** Anything under Students keeps the Students entry lit. */
const STUDENT_PAGES = ["/students", "/send", "/nudges", "/messages"];

const MOBILE_NAV = NAV;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { db, ready, signedIn, lastError, clearError } = useStore();
  const isActive = (href: string) =>
    href === "/students"
      ? STUDENT_PAGES.some((p) => pathname.startsWith(p))
      : pathname.startsWith(href);

  if (!ready) return <Splash />;
  if (!signedIn) return <AuthScreen />;

  const autopilotOn = db.settings.autopilot;
  const connected = db.settings.telegramConnected;

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:flex-col w-[244px] shrink-0 p-3">
        <div className="h-16 flex items-center px-3">
          <Link href="/dashboard" className="flex items-baseline gap-2">
            <span className="text-[19px] font-bold tracking-[-0.03em] text-forest">
              Labbay
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex items-center gap-3 h-11 px-3.5 rounded-[16px] text-[14px] transition-colors",
                isActive(href)
                  ? "bg-paper text-forest font-bold shadow-[0_1px_2px_rgb(23_23_23/0.04)]"
                  : "text-muted hover:text-forest hover:bg-paper/60",
              )}
            >
              <Icon
                className={cx(
                  "w-[19px] h-[19px] shrink-0",
                  isActive(href) ? "text-forest" : "text-faint",
                )}
              />
              {label}
            </Link>
          ))}
        </nav>

        {/* Status — the two facts that decide whether anything actually sends. */}
        <div className="card-mint px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span
              className={cx(
                "w-1.5 h-1.5 rounded-full shrink-0",
                autopilotOn ? "bg-accent" : "bg-faint",
              )}
            />
            <span className="text-[12.5px] font-bold text-forest">
              Autopilot {autopilotOn ? "on" : "off"}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-forest/70 leading-snug">
            {connected
              ? autopilotOn
                ? "Due nudges send themselves."
                : "Nudges wait for you to send."
              : "Telegram is off, so nothing leaves the app."}
          </p>
        </div>
      </aside>

      {/* Header — mobile */}
      <header className="md:hidden h-14 flex items-center justify-between px-5">
        <Link
          href="/dashboard"
          className="text-[18px] font-bold tracking-[-0.03em] text-forest"
        >
          Labbay
        </Link>
        <Link href="/settings" aria-label="Settings" className="text-faint">
          <IconSettings className="w-5 h-5" />
        </Link>
      </header>

      {/* A failed save must never pass unnoticed. */}
      {lastError ? (
        <div
          role="alert"
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[min(560px,92vw)] rounded-[18px] bg-clay text-white px-5 py-4 lift"
        >
          <p className="text-[13.5px] font-bold">That did not save</p>
          <p className="text-[12.5px] text-white/85 mt-1 leading-relaxed break-words">
            {lastError}
          </p>
          <button
            type="button"
            onClick={clearError}
            className="mt-2.5 text-[12.5px] font-bold underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <main className="flex-1 min-w-0 pb-24 md:pb-0 md:pr-3 md:py-3">
        <div className="md:card md:min-h-[calc(100dvh-1.5rem)]">{children}</div>
      </main>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-[72px] bg-paper/95 backdrop-blur border-t border-line flex">
        {MOBILE_NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex-1 flex flex-col items-center justify-center gap-1 text-[10px]",
              isActive(href) ? "text-forest font-bold" : "text-faint",
            )}
          >
            <Icon className="w-[20px] h-[20px]" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Standard page frame: title, optional action, consistent gutters. */
export function Page({
  title,
  subtitle,
  action,
  backHref,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Shown on phones, where the bottom nav cannot reach every screen. */
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-[1080px] mx-auto px-5 md:px-8 py-6 md:py-9">
      {backHref ? (
        <Link
          href={backHref}
          className="md:hidden inline-flex items-center gap-1.5 h-9 -ml-1 mb-3 pr-3 pl-1 rounded-full text-[13.5px] font-semibold text-muted hover:text-forest"
        >
          <IconArrowLeft className="w-[18px] h-[18px]" />
          Back
        </Link>
      ) : null}
      <header className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="display text-[30px] md:text-[38px]">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-[13.5px] text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </div>
  );
}
