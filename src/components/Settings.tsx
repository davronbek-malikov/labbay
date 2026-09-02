"use client";

import { useState, type ReactNode } from "react";
import { Button, Input, Toggle } from "@/components/ui";
import {
  IconArrowLeft,
  IconBolt,
  IconChevron,
  IconDatabase,
  IconGauge,
  IconInfo,
  IconMoon,
  IconPen,
  IconSend,
  IconUser,
} from "@/components/icons";
import { time } from "@/lib/format";
import type { DeliveryMode, Language, Tone } from "@/lib/types";

/**
 * The settings screen, in the shape people already know from their phone:
 * a menu of grouped rows, each opening one focused page.
 *
 * Adding a setting is three edits — a name in `Page`, an early return, and a
 * row in the menu.
 *
 * This component holds no data of its own beyond which page is open. The
 * parent owns every value and every write.
 */

type Page =
  | "menu"
  | "account"
  | "telegram"
  | "automation"
  | "limits"
  | "quiet"
  | "writing"
  | "data"
  | "about";

export interface SettingsState {
  teacherName: string;
  email: string | null;
  mode: "cloud" | "local";
  telegramConnected: boolean;
  delayMinSeconds: number;
  delayMaxSeconds: number;
  dailyCap: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  defaultTone: Tone;
  language: Language;
  autopilot: boolean;
  deliveryMode: DeliveryMode;
  workerSeenAt: string | null;
  lastAutoRunAt: string | null;
  /** Why autopilot is holding off right now, or null when it is running. */
  autopilotBlockedBy: string | null;
  counts: { students: number; nudges: number; messages: number };
}

export interface SettingsActions {
  onSetName(name: string): void;
  onSetSendingEnabled(on: boolean): void;
  onSetDelay(min: number, max: number): void;
  onSetDailyCap(cap: number): void;
  onSetQuietHours(start: number, end: number): void;
  onSetTone(tone: Tone): void;
  onSetLanguage(language: Language): void;
  onSetAutopilot(on: boolean): void;
  onSetDeliveryMode(mode: DeliveryMode): void;
  onRunAutopilot(): { queued: number; delivered: number; nudges: number };
  onLoadSample(): Promise<void>;
  onClearData(): void;
  onSignOut(): void;
  onDeleteAccount(): Promise<string | null>;
}

/* ======================================================= module-level parts
   These live here, not inside Settings. An inline component gets a fresh
   identity on every render, which remounts its children — and on a phone that
   closes the keyboard after every keystroke. */

function SubPage({
  title,
  onMenu,
  children,
}: {
  title: string;
  onMenu: () => void;
  children: ReactNode;
}) {
  return (
    <div className="max-w-[620px] mx-auto px-5 md:px-8 py-6 md:py-9">
      <button
        type="button"
        onClick={onMenu}
        className="inline-flex items-center gap-1 -ml-1 mb-4 h-9 pr-3 pl-1 rounded-full text-[14px] font-semibold text-accent hover:text-forest"
      >
        <IconArrowLeft className="w-[18px] h-[18px]" />
        Settings
      </button>
      <h1 className="display text-[28px] md:text-[34px] mb-7">{title}</h1>
      {children}
    </div>
  );
}

function MenuRow({
  icon,
  color,
  title,
  sub,
  onClick,
}: {
  icon: ReactNode;
  /** A CSS variable, so themes can restyle every row at once. */
  color: string;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="set-row" onClick={onClick}>
      <span className="set-chip" style={{ background: color }}>
        {icon}
      </span>
      <span className="set-text">
        <span className="set-title block">{title}</span>
        <span className="set-sub block">{sub}</span>
      </span>
      <IconChevron className="set-chevron w-[18px] h-[18px]" />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg-btn"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label?: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      {label ? (
        <span className="block text-[12px] text-faint mb-1">{label}</span>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label ?? "value"}
        className="w-full accent-[#12a873] h-1.5"
      />
    </div>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="set-card">{children}</div>;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="text-[12.5px] text-muted leading-relaxed mt-3 px-1">
      {children}
    </p>
  );
}

const TONES: Array<{ value: Tone; label: string }> = [
  { value: "warm", label: "Warm" },
  { value: "direct", label: "Direct" },
  { value: "playful", label: "Playful" },
  { value: "formal", label: "Formal" },
];

const LANGUAGES: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "uz", label: "O'zbekcha" },
];

const toneLabel = (t: Tone) => TONES.find((x) => x.value === t)?.label ?? t;
const languageLabel = (l: Language) =>
  LANGUAGES.find((x) => x.value === l)?.label ?? l;

/* ================================================================ screen */

export function Settings({
  state,
  actions,
}: {
  state: SettingsState;
  actions: SettingsActions;
}) {
  const [page, setPage] = useState<Page>("menu");
  const menu = () => setPage("menu");

  // Page-local scratch state only — never domain data.
  const [name, setName] = useState(state.teacherName);
  const [ran, setRan] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteWord, setDeleteWord] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [quietEditing, setQuietEditing] = useState<"start" | "end">("start");

  /* ------------------------------------------------------------- account */

  if (page === "account") {
    return (
      <SubPage title="Account" onMenu={menu}>
        <Group>
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="w-12 h-12 shrink-0 rounded-full bg-mint text-forest grid place-items-center text-[15px] font-bold">
              {(state.teacherName || state.email || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold truncate">
                {state.teacherName || "No name set"}
              </p>
              <p className="text-[12.5px] text-muted truncate">
                {state.email ?? "Local mode — not signed in"}
              </p>
            </div>
          </div>
        </Group>

        <div className="mt-6">
          <span className="label block mb-2 px-1">Your name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && actions.onSetName(name.trim())}
            placeholder="Davronbek"
          />
          <Note>This is the name the app greets you with.</Note>
        </div>

        {state.mode === "cloud" ? (
          <>
            <div className="mt-8">
              <Button variant="primary" onClick={actions.onSignOut} className="w-full">
                Sign out
              </Button>
            </div>

            <div className="mt-8">
              <span className="label block mb-2 px-1">Danger zone</span>
              <div className="set-card p-4">
                {!confirmDelete ? (
                  <>
                    <p className="text-[13.5px] font-semibold">Delete account</p>
                    <p className="text-[12.5px] text-muted mt-1 leading-relaxed">
                      Removes your account and every student, nudge, and message.
                      This cannot be undone.
                    </p>
                    <Button
                      variant="danger"
                      className="mt-3"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete account
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[13.5px] font-semibold">
                      Type DELETE to confirm
                    </p>
                    <p className="text-[12.5px] text-muted leading-relaxed">
                      Your account and all {state.counts.students} students,{" "}
                      {state.counts.nudges} nudges, and {state.counts.messages}{" "}
                      messages will be gone for good.
                    </p>
                    <Input
                      value={deleteWord}
                      onChange={(e) => setDeleteWord(e.target.value)}
                      placeholder="DELETE"
                      aria-label="Type DELETE to confirm"
                    />
                    {deleteError ? (
                      <p className="text-[13px] text-clay">{deleteError}</p>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setConfirmDelete(false);
                          setDeleteWord("");
                          setDeleteError(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        disabled={deleteWord !== "DELETE" || deleting}
                        onClick={() => {
                          setDeleting(true);
                          setDeleteError(null);
                          void actions
                            .onDeleteAccount()
                            .then((problem) => problem && setDeleteError(problem))
                            .finally(() => setDeleting(false));
                        }}
                      >
                        {deleting ? "Deleting…" : "Delete for good"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <Note>
            Running without a Supabase project, so there is no account to sign out
            of and data stays in this browser.
          </Note>
        )}
      </SubPage>
    );
  }

  /* ------------------------------------------------------------ telegram */

  if (page === "telegram") {
    const seen = state.workerSeenAt
      ? Math.floor((Date.now() - new Date(state.workerSeenAt).getTime()) / 1000)
      : null;
    // The worker stamps every 30s, so two minutes of silence means it stopped.
    const workerAlive = seen !== null && seen < 120;
    const workerMode = state.deliveryMode === "worker";

    return (
      <SubPage title="Telegram" onMenu={menu}>
        <Group>
          <div className="flex items-center gap-3 px-4 py-4">
            <Toggle
              checked={state.telegramConnected}
              onChange={actions.onSetSendingEnabled}
              label="Allow sending"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold">
                Sending is {state.telegramConnected ? "on" : "off"}
              </p>
              <p className="text-[12.5px] text-muted">
                {state.telegramConnected
                  ? "Messages are allowed to leave the app."
                  : "Nothing goes out. Everything stays queued."}
              </p>
            </div>
          </div>
        </Group>

        <Note>
          This is a switch you can reach from anywhere. Turning it off stops the
          worker within about thirty seconds.
        </Note>

        <div className="mt-7">
          <span className="label block mb-2 px-1">Who delivers</span>
          <Segmented
            value={state.deliveryMode}
            onChange={actions.onSetDeliveryMode}
            label="Delivery mode"
            options={[
              { value: "simulate", label: "Simulate" },
              { value: "worker", label: "Real worker" },
            ]}
          />
          <Note>
            {state.deliveryMode === "simulate"
              ? "The app marks messages as sent so you can try everything out. Nothing reaches Telegram."
              : "Only the worker on your server sends. It has to be running, or messages sit in the queue."}
          </Note>
        </div>

        {workerMode ? (
          <div className="mt-7">
            <span className="label block mb-2 px-1">Worker</span>
            <Group>
              <div className="flex items-center gap-3 px-4 py-4">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    background: workerAlive
                      ? "var(--color-accent)"
                      : "var(--color-clay)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold">
                    {workerAlive ? "Running" : "Not running"}
                  </p>
                  <p className="text-[12.5px] text-muted">
                    {seen === null
                      ? "It has never checked in."
                      : workerAlive
                        ? `Last checked in ${seen < 60 ? `${seen}s` : `${Math.floor(seen / 60)}m`} ago.`
                        : `Silent for ${Math.floor(seen / 60)} minutes.`}
                  </p>
                </div>
              </div>
            </Group>
            {!workerAlive ? (
              <Note>
                Start it on your machine or your server with{" "}
                <span className="tabular">npm start</span> in the worker folder.
                Nothing sends while it is down.
              </Note>
            ) : null}
          </div>
        ) : null}

        <div className="mt-7">
          <span className="label block mb-2 px-1">Which account</span>
          <Group>
            <div className="px-4 py-4">
              <p className="text-[13.5px] leading-relaxed text-muted">
                Messages send from your own Telegram account, so students see
                them coming from you and not from a bot.
              </p>
              <p className="text-[13.5px] leading-relaxed text-muted mt-3">
                You sign in once on the worker, not here — a browser is the wrong
                place for the credentials to your account. Run{" "}
                <span className="tabular">npm run login</span> in the worker
                folder to sign in or to switch to a different account.
              </p>
            </div>
          </Group>
        </div>
      </SubPage>
    );
  }

  /* ---------------------------------------------------------- automation */

  if (page === "automation") {
    return (
      <SubPage title="Automatic sending" onMenu={menu}>
        <Group>
          <div className="flex items-center gap-3 px-4 py-4">
            <Toggle
              checked={state.autopilot}
              onChange={actions.onSetAutopilot}
              label="Autopilot"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold">
                Autopilot is {state.autopilot ? "on" : "off"}
              </p>
              <p className="text-[12.5px] text-muted">
                {state.autopilotBlockedBy
                  ? `Held right now: ${state.autopilotBlockedBy.toLowerCase()}.`
                  : "Due nudges are sending on their own."}
              </p>
            </div>
          </div>
        </Group>

        <Note>
          With autopilot on, a nudge sends itself the moment its day and time
          arrive. You never press anything.
        </Note>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              const r = actions.onRunAutopilot();
              setRan(
                r.queued || r.delivered
                  ? `Queued ${r.queued} from ${r.nudges} nudge${r.nudges === 1 ? "" : "s"}, delivered ${r.delivered}.`
                  : "Nothing was due.",
              );
            }}
          >
            Run due nudges now
          </Button>
          <span className="text-[12.5px] text-muted">
            {ran ??
              (state.lastAutoRunAt
                ? `Last checked ${new Date(state.lastAutoRunAt).toLocaleString()}`
                : "Not checked yet")}
          </span>
        </div>

        <Note>
          Autopilot runs while Labbay is open in a browser tab. Once the Telegram
          worker is deployed it will run around the clock instead.
        </Note>
      </SubPage>
    );
  }

  /* -------------------------------------------------------------- limits */

  if (page === "limits") {
    return (
      <SubPage title="Sending limits" onMenu={menu}>
        <div className="set-card p-5 space-y-6">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="label">Gap between messages</span>
              <span className="tabular text-[13px] font-semibold">
                {state.delayMinSeconds}–{state.delayMaxSeconds}s
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Slider
                label="Shortest"
                min={10}
                max={120}
                value={state.delayMinSeconds}
                onChange={(v) =>
                  actions.onSetDelay(
                    Math.min(v, state.delayMaxSeconds - 5),
                    state.delayMaxSeconds,
                  )
                }
              />
              <Slider
                label="Longest"
                min={30}
                max={600}
                value={state.delayMaxSeconds}
                onChange={(v) =>
                  actions.onSetDelay(
                    state.delayMinSeconds,
                    Math.max(v, state.delayMinSeconds + 5),
                  )
                }
              />
            </div>
            <p className="mt-2 text-[12.5px] text-muted">
              Each message waits a random time in this range, so sends never
              arrive as one identical burst.
            </p>
          </div>

          <div className="pt-5 border-t border-line">
            <div className="flex items-baseline justify-between mb-2">
              <span className="label">Most messages per day</span>
              <span className="tabular text-[13px] font-semibold">
                {state.dailyCap}
              </span>
            </div>
            <Slider
              min={5}
              max={200}
              value={state.dailyCap}
              onChange={actions.onSetDailyCap}
            />
            <p className="mt-2 text-[12.5px] text-muted">
              Anything over this waits until tomorrow. You have{" "}
              <span className="tabular">{state.counts.students}</span> students.
            </p>
          </div>
        </div>

        <Note>
          Telegram limits how fast one account may message people. These keep you
          inside those limits.
        </Note>
      </SubPage>
    );
  }

  /* --------------------------------------------------------- quiet hours */

  if (page === "quiet") {
    const current =
      quietEditing === "start" ? state.quietHoursStart : state.quietHoursEnd;
    return (
      <SubPage title="Quiet hours" onMenu={menu}>
        <Segmented
          value={quietEditing}
          onChange={setQuietEditing}
          label="Which end to change"
          options={[
            { value: "start", label: `Starts ${time(state.quietHoursStart, 0)}` },
            { value: "end", label: `Ends ${time(state.quietHoursEnd, 0)}` },
          ]}
        />

        <div className="grid grid-cols-6 gap-2 mt-5">
          {Array.from({ length: 24 }, (_, h) => (
            <button
              key={h}
              type="button"
              aria-pressed={current === h}
              onClick={() =>
                quietEditing === "start"
                  ? actions.onSetQuietHours(h, state.quietHoursEnd)
                  : actions.onSetQuietHours(state.quietHoursStart, h)
              }
              className={
                current === h
                  ? "tabular h-11 rounded-[14px] bg-forest text-white text-[13px] font-bold"
                  : "tabular h-11 rounded-[14px] bg-field text-muted text-[13px] font-semibold hover:bg-line"
              }
            >
              {String(h).padStart(2, "0")}
            </button>
          ))}
        </div>

        <Note>
          Nothing sends between {time(state.quietHoursStart, 0)} and{" "}
          {time(state.quietHoursEnd, 0)}. Sending by hand still works — quiet
          hours only hold back autopilot.
        </Note>
      </SubPage>
    );
  }

  /* ------------------------------------------------------------- writing */

  if (page === "writing") {
    return (
      <SubPage title="Writing" onMenu={menu}>
        <span className="label block mb-2 px-1">Default tone</span>
        <Segmented
          value={state.defaultTone}
          options={TONES}
          onChange={actions.onSetTone}
          label="Default tone"
        />
        <Note>
          New nudges start with this tone. Each nudge can still choose its own.
        </Note>

        <div className="mt-8">
          <span className="label block mb-2 px-1">Language</span>
          <Segmented
            value={state.language}
            options={LANGUAGES}
            onChange={actions.onSetLanguage}
            label="Language"
          />
          <Note>
            The language your students&apos; messages are written in.
          </Note>
        </div>
      </SubPage>
    );
  }

  /* ---------------------------------------------------------------- data */

  if (page === "data") {
    return (
      <SubPage title="Data" onMenu={menu}>
        <Group>
          <div className="px-4 py-4">
            <p className="text-[13.5px] font-semibold">Load sample class</p>
            <p className="text-[12.5px] text-muted mt-1 leading-relaxed">
              Adds 15 example students and 4 nudges alongside what you already
              have.
            </p>
            <Button
              className="mt-3"
              disabled={loadingSample || state.mode !== "cloud"}
              onClick={() => {
                setLoadingSample(true);
                void actions.onLoadSample().finally(() => setLoadingSample(false));
              }}
            >
              {loadingSample ? "Loading…" : "Load"}
            </Button>
          </div>
        </Group>

        <div className="mt-6">
          <span className="label block mb-2 px-1">Danger zone</span>
          <div className="set-card px-4 py-4">
            <p className="text-[13.5px] font-semibold">Clear everything</p>
            <p className="text-[12.5px] text-muted mt-1 leading-relaxed">
              Deletes all {state.counts.students} students, {state.counts.nudges}{" "}
              nudges, and {state.counts.messages} messages. Your account stays.
            </p>
            <Button
              variant="danger"
              className="mt-3"
              onClick={() => {
                if (confirm("Delete all students, nudges, and messages?"))
                  actions.onClearData();
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </SubPage>
    );
  }

  /* --------------------------------------------------------------- about */

  if (page === "about") {
    return (
      <SubPage title="About" onMenu={menu}>
        <Group>
          <div className="set-row" style={{ cursor: "default" }}>
            <span className="set-text">
              <span className="set-title block">Version</span>
            </span>
            <span className="tabular text-[13px] text-muted">0.1.0 beta</span>
          </div>
          <div className="set-row" style={{ cursor: "default" }}>
            <span className="set-text">
              <span className="set-title block">Storage</span>
            </span>
            <span className="text-[13px] text-muted">
              {state.mode === "cloud" ? "Synced" : "This browser only"}
            </span>
          </div>
          <div className="set-row" style={{ cursor: "default" }}>
            <span className="set-text">
              <span className="set-title block">Students</span>
            </span>
            <span className="tabular text-[13px] text-muted">
              {state.counts.students}
            </span>
          </div>
        </Group>
        <Note>
          Labbay keeps every student hearing from you between lessons, so nobody
          quietly drifts away.
        </Note>
      </SubPage>
    );
  }

  /* ---------------------------------------------------------------- menu */

  return (
    <div className="max-w-[620px] mx-auto px-5 md:px-8 py-6 md:py-9">
      <h1 className="display text-[30px] md:text-[38px] mb-7">Settings</h1>

      <Group>
        <MenuRow
          icon={<IconUser className="w-[19px] h-[19px]" />}
          color="var(--color-chip-forest)"
          title="Account"
          sub={state.teacherName || state.email || "Not signed in"}
          onClick={() => setPage("account")}
        />
      </Group>

      <div className="mt-5">
        <Group>
          <MenuRow
            icon={<IconSend className="w-[19px] h-[19px]" />}
            color="var(--color-chip-blue)"
            title="Telegram"
            sub={state.telegramConnected ? "Sending on" : "Sending off"}
            onClick={() => setPage("telegram")}
          />
          <MenuRow
            icon={<IconBolt className="w-[19px] h-[19px]" />}
            color="var(--color-chip-green)"
            title="Automatic sending"
            sub={state.autopilot ? "On" : "Off"}
            onClick={() => setPage("automation")}
          />
        </Group>
      </div>

      <div className="mt-5">
        <Group>
          <MenuRow
            icon={<IconGauge className="w-[19px] h-[19px]" />}
            color="var(--color-chip-amber)"
            title="Sending limits"
            sub={`${state.dailyCap} a day · ${state.delayMinSeconds}–${state.delayMaxSeconds}s apart`}
            onClick={() => setPage("limits")}
          />
          <MenuRow
            icon={<IconMoon className="w-[19px] h-[19px]" />}
            color="var(--color-chip-slate)"
            title="Quiet hours"
            sub={`${time(state.quietHoursStart, 0)} – ${time(state.quietHoursEnd, 0)}`}
            onClick={() => setPage("quiet")}
          />
          <MenuRow
            icon={<IconPen className="w-[19px] h-[19px]" />}
            color="var(--color-chip-violet)"
            title="Writing"
            sub={`${toneLabel(state.defaultTone)} · ${languageLabel(state.language)}`}
            onClick={() => setPage("writing")}
          />
        </Group>
      </div>

      <div className="mt-5">
        <Group>
          <MenuRow
            icon={<IconDatabase className="w-[19px] h-[19px]" />}
            color="var(--color-chip-clay)"
            title="Data"
            sub={`${state.counts.students} students · ${state.counts.messages} messages`}
            onClick={() => setPage("data")}
          />
          <MenuRow
            icon={<IconInfo className="w-[19px] h-[19px]" />}
            color="var(--color-chip-slate)"
            title="About"
            sub={state.mode === "cloud" ? "Synced across devices" : "This browser only"}
            onClick={() => setPage("about")}
          />
        </Group>
      </div>
    </div>
  );
}
