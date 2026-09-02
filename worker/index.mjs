/**
 * Labbay's sender.
 *
 * The web app decides what to say and when. This process is the only thing
 * that actually puts a message into Telegram, and the only thing that marks a
 * message as sent. It has to run somewhere always-on, because an MTProto
 * session is a long-lived connection that a serverless function cannot hold.
 *
 *   npm install
 *   npm run login     # once, to get TELEGRAM_SESSION
 *   npm start
 */
import { createClient } from "@supabase/supabase-js";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { FloodWaitError } from "telegram/errors/index.js";

/* ------------------------------------------------------------------ config */

const {
  TELEGRAM_API_ID,
  TELEGRAM_API_HASH,
  TELEGRAM_SESSION,
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  TEACHER_ID,
  POLL_SECONDS = "30",
  DRY_RUN = "0",
} = process.env;

const missing = Object.entries({
  TELEGRAM_API_ID,
  TELEGRAM_API_HASH,
  TELEGRAM_SESSION,
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  TEACHER_ID,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// A flag works in every shell; the env var is kept for hosted deploys.
// (PowerShell has no `VAR=1 cmd` syntax, so `npm run dry-run` is the safe way.)
const dryRun = DRY_RUN === "1" || process.argv.includes("--dry-run");
const pollMs = Math.max(10, Number(POLL_SECONDS)) * 1000;

/**
 * Floors the app's settings cannot go below.
 *
 * The sliders in the app are generous, and a mistyped value there should not
 * be able to get the account limited. These are the real limits.
 */
const MIN_GAP_SECONDS = 15;
const MAX_PER_CYCLE = 25;
const MAX_PHONE_IMPORTS_PER_CYCLE = 5;
/** A claimed message older than this was orphaned by a crash. */
const STALE_CLAIM_MINUTES = 10;

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const tg = new TelegramClient(
  new StringSession(TELEGRAM_SESSION),
  Number(TELEGRAM_API_ID),
  TELEGRAM_API_HASH,
  { connectionRetries: 5 },
);

/* ----------------------------------------------------------------- helpers */

const log = (...args) =>
  console.log(new Date().toISOString().slice(11, 19), ...args);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A random wait inside the teacher's configured range. */
function gap(settings) {
  const min = Number(settings.delay_min_seconds ?? 45);
  const max = Number(settings.delay_max_seconds ?? 180);
  const lo = Math.max(MIN_GAP_SECONDS, Math.min(min, max));
  const hi = Math.max(lo, Math.max(min, max));
  return (lo + Math.random() * (hi - lo)) * 1000;
}

/** Quiet hours may wrap past midnight, so handle both shapes. */
function inQuietHours(hour, settings) {
  const start = Number(settings.quiet_hours_start ?? 22);
  const end = Number(settings.quiet_hours_end ?? 8);
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

/**
 * Turns "@name" or "+998901234567" into something Telegram will accept.
 *
 * A phone number only works if that person is in your contacts, so it gets
 * imported first. That is also why a handle is the more reliable choice.
 */
let phoneImportsThisCycle = 0;

async function resolve(handle) {
  const value = (handle ?? "").trim();
  if (!value) throw new Error("No Telegram handle or phone number on file");

  if (value.startsWith("@")) {
    return await tg.getInputEntity(value);
  }

  if (/^\+?\d[\d\s-]{6,}$/.test(value)) {
    // Importing contacts in volume is one of the things Telegram watches, so
    // only a few per cycle. The rest stay queued for the next round.
    if (phoneImportsThisCycle >= MAX_PHONE_IMPORTS_PER_CYCLE) {
      throw new Error(
        "Too many phone-number lookups this cycle. It will be retried shortly — an @username avoids this entirely.",
      );
    }
    phoneImportsThisCycle++;
    const phone = value.replace(/[^\d+]/g, "");
    const imported = await tg.invoke(
      new Api.contacts.ImportContacts({
        contacts: [
          new Api.InputPhoneContact({
            clientId: BigInt(Math.floor(Math.random() * 1e15)),
            phone,
            firstName: "Labbay",
            lastName: "student",
          }),
        ],
      }),
    );
    if (!imported.users?.length) {
      throw new Error(
        "That phone number has no Telegram account, or its privacy settings block being found by number. Use their @username instead.",
      );
    }
    return imported.users[0];
  }

  // Bare username without the @.
  return await tg.getInputEntity(`@${value}`);
}

/* -------------------------------------------------------------------- data */

async function loadSettings() {
  const { data, error } = await db
    .from("settings")
    .select("*")
    .eq("teacher_id", TEACHER_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No settings row for teacher ${TEACHER_ID}`);
  return data;
}

async function sentToday() {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count, error } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", TEACHER_ID)
    .eq("status", "sent")
    .gte("sent_at", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}

async function dueMessages(limit) {
  const { data, error } = await db
    .from("messages")
    .select("id, student_id, text")
    .eq("teacher_id", TEACHER_ID)
    .eq("status", "queued")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function studentFor(id) {
  const { data, error } = await db
    .from("students")
    .select("id, name, telegram, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Moves one message queued -> sending, and reports whether we got it.
 *
 * The `.eq("status", "queued")` is the whole point: if another worker claimed
 * it first, this update matches no rows and we skip it. Without it two workers
 * would each read the same queued row and the student would be messaged twice.
 */
async function claim(messageId) {
  const { data, error } = await db
    .from("messages")
    .update({ status: "sending" })
    .eq("id", messageId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Puts a claimed message back so it is retried rather than lost. */
async function release(messageId) {
  await db
    .from("messages")
    .update({ status: "queued" })
    .eq("id", messageId)
    .eq("status", "sending");
}

/** Recovers anything a crash left mid-flight. */
async function recoverStaleClaims() {
  const cutoff = new Date(Date.now() - STALE_CLAIM_MINUTES * 60_000).toISOString();
  const { data, error } = await db
    .from("messages")
    .update({ status: "queued" })
    .eq("teacher_id", TEACHER_ID)
    .eq("status", "sending")
    .lt("scheduled_at", cutoff)
    .select("id");
  if (error) throw error;
  if (data?.length) log(`recovered ${data.length} message(s) left mid-send`);
}

async function markSent(messageId, studentId) {
  const now = new Date().toISOString();
  await db
    .from("messages")
    .update({ status: "sent", sent_at: now, error: null })
    .eq("id", messageId)
    .eq("status", "sending");
  await db
    .from("students")
    .update({ last_contacted_at: now })
    .eq("id", studentId);
}

async function markFailed(messageId, reason) {
  await db
    .from("messages")
    .update({ status: "failed", error: String(reason).slice(0, 300) })
    .eq("id", messageId);
}

/* -------------------------------------------------------------------- loop */

async function heartbeat() {
  await db
    .from("settings")
    .update({ worker_seen_at: new Date().toISOString() })
    .eq("teacher_id", TEACHER_ID);
}

async function tick() {
  const settings = await loadSettings();
  // Stamped before any early return, so "holding" still counts as alive.
  await heartbeat();

  if (!settings.telegram_connected) {
    log("sending is switched off in the app — holding");
    return;
  }

  if (settings.delivery_mode !== "worker") {
    log('delivery mode is not "worker" — holding so the app and I do not both send');
    return;
  }

  const hour = new Date().getHours();
  if (inQuietHours(hour, settings)) {
    log("quiet hours — holding");
    return;
  }

  const cap = Number(settings.daily_cap ?? 40);
  const already = await sentToday();
  const room = cap - already;
  if (room <= 0) {
    log(`daily cap reached (${already}/${cap}) — holding until tomorrow`);
    return;
  }

  phoneImportsThisCycle = 0;
  await recoverStaleClaims();

  const due = await dueMessages(Math.min(room, MAX_PER_CYCLE));
  if (due.length === 0) return;

  log(`${due.length} due, ${room} left under today's cap of ${cap}`);

  for (const message of due) {
    // Nothing below this line may run twice for the same message.
    if (!(await claim(message.id))) continue;

    const student = await studentFor(message.student_id);

    if (!student) {
      await markFailed(message.id, "That student was removed");
      continue;
    }
    if (student.status !== "active") {
      await markFailed(message.id, `${student.name} is paused`);
      continue;
    }

    try {
      if (dryRun) {
        // Nothing is sent and nothing is marked. Put the message straight back
        // so a rehearsal never eats the real queue.
        log(`DRY RUN -> ${student.name} (${student.telegram}): ${message.text}`);
        await release(message.id);
        continue;
      }

      const peer = await resolve(student.telegram);
      await tg.sendMessage(peer, { message: message.text });
      await markSent(message.id, student.id);
      log(`sent to ${student.name}`);
    } catch (error) {
      if (error instanceof FloodWaitError) {
        // Telegram is asking us to slow down. Give the message back and wait
        // it out rather than burning the account.
        await release(message.id);
        const wait = (error.seconds + 5) * 1000;
        log(`flood wait ${error.seconds}s — pausing, message returned to the queue`);
        await sleep(wait);
        return;
      }
      log(`failed for ${student.name}: ${error.message}`);
      if (dryRun) await release(message.id);
      else await markFailed(message.id, error.message);
    }

    // Space the sends out so they never look like a burst.
    if (due.indexOf(message) < due.length - 1) await sleep(gap(settings));
  }
}

/* -------------------------------------------------------------------- boot */

// Check Supabase before Telegram, so a typo in the URL is obvious rather
// than surfacing later as a bare "fetch failed" inside the loop.
log("checking Supabase…");
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL.trim())) {
  console.error(
    `SUPABASE_URL does not look like a project URL: ${SUPABASE_URL}
` +
      "It should be https://<your-project-ref>.supabase.co — copy it from " +
      "Supabase -> Project Settings -> API.",
  );
  process.exit(1);
}
try {
  await loadSettings();
  log("Supabase reachable, settings found");
} catch (error) {
  console.error(`Could not read settings from Supabase: ${error.message}`);
  console.error(
    "Check SUPABASE_URL, SUPABASE_SECRET_KEY (the sb_secret_ one), and that " +
      `TEACHER_ID (${TEACHER_ID}) is your user's UID in Authentication -> Users.`,
  );
  process.exit(1);
}

log("connecting to Telegram…");
await tg.connect();

if (!(await tg.isUserAuthorized())) {
  console.error(
    "That session is not valid. Run `npm run login` again and update TELEGRAM_SESSION.",
  );
  process.exit(1);
}

const me = await tg.getMe();
log(`signed in as ${[me.firstName, me.lastName].filter(Boolean).join(" ")}`);
log(`teacher ${TEACHER_ID}, polling every ${pollMs / 1000}s${dryRun ? " (DRY RUN)" : ""}`);

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    stopping = true;
    log("shutting down");
    await tg.disconnect().catch(() => {});
    process.exit(0);
  });
}

while (!stopping) {
  try {
    await tick();
  } catch (error) {
    // One bad cycle must never kill the worker.
    log(`cycle error: ${error.message}`);
  }
  await sleep(pollMs);
}
