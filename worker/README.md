# Labbay worker

The only thing that actually sends a message to Telegram.

The web app decides *what* to say and *when*. This process picks up queued
messages, sends them from your own Telegram account, and marks them sent. It
has to run somewhere always-on — an MTProto session is a long-lived connection,
which is why it cannot live on Vercel.

## Before you start

You are automating your personal Telegram account. Telegram's terms do not
permit this, and accounts that automate through the user API can be rate
limited or banned. The delay, daily cap, and quiet hour settings in the app
exist to keep the traffic looking human; do not raise them far.

Use `@usernames` rather than phone numbers where you can. A phone number only
works if that person can be found by number, and importing contacts in volume
is one of the things Telegram watches.

## What can go wrong, and what stops it

| Risk | Protection |
|---|---|
| Session string leaks → someone **is** you on Telegram | It lives only in `worker/.env`, which is gitignored, and is never logged. Revoke it any time: Telegram → Settings → Devices → terminate the session. |
| Supabase secret key leaks → full read/write of every teacher's data | Only ever on this server, never in the browser. Rotate it in Supabase → Project Settings → API. |
| Two workers double-message a student | Each message is claimed `queued -> sending` in one atomic update. A second worker's claim matches no rows and it skips. |
| A crash leaves messages stuck mid-send | Anything claimed for more than 10 minutes is returned to the queue on the next cycle. |
| A mistyped setting causes a burst and a ban | Hard floors the app cannot override: at least 15s between sends, at most 25 per cycle. |
| Bulk phone lookups look like scraping | At most 5 phone-number imports per cycle. Use `@usernames`. |
| Telegram asks you to slow down | `FloodWait` is caught, the message is returned to the queue, and the worker waits it out. |
| You need to stop everything from your phone | Switch Telegram off in the app's Settings — the worker checks it every cycle and holds. |

## Setup

### 1. Telegram API credentials

Go to <https://my.telegram.org> → **API development tools** → create an app.
Note the **api_id** and **api_hash**.

### 2. Install and log in

```bash
cd worker
cp .env.example .env      # then fill in TELEGRAM_API_ID and TELEGRAM_API_HASH
npm install
npm run login
```

It asks for your phone, the code Telegram sends **to your Telegram app** (not
by SMS), and your two-step password if you have one. It prints a session
string — paste that into `.env` as `TELEGRAM_SESSION`.

That string *is* your account. Never commit it, never paste it anywhere.

### 3. Supabase credentials

In Supabase → **Project Settings → API**:

- `SUPABASE_URL` — your project URL
- `SUPABASE_SECRET_KEY` — the **secret** key (`sb_secret_…`), not the
  publishable one. It bypasses row level security, so it must only ever live on
  this server.

In Supabase → **Authentication → Users**, copy your own user's UID into
`TEACHER_ID`. That is the account whose messages this worker sends.

### 4. Try it without sending anything

```bash
DRY_RUN=1 npm start
```

It connects, reads due messages, and logs what it *would* send. Nothing reaches
Telegram, and nothing is marked sent.

### 5. Go live

In the app: **Settings → Telegram**, set **Who delivers** to **Real worker**,
and make sure Telegram shows as connected. Then:

```bash
npm start
```

## Delivery modes

The app has two modes, and they must never both be active:

| Mode | What happens |
|---|---|
| **Simulate** | The app marks messages sent. Nothing reaches Telegram. For trying the app out. |
| **Real worker** | Only this worker sends and marks messages. The app never touches their status. |

The worker refuses to run while the app is in Simulate, so you cannot
accidentally have both marking the same message.

Switching **Telegram** off in the app also stops the worker — it is a kill
switch you can reach from your phone.

## Keeping it running

Any always-on host works. Railway is the least fuss:

1. New project → Deploy from GitHub repo → set the root directory to `worker`
2. Add every variable from `.env` in the service's Variables tab
3. Start command: `npm start`

Fly.io, Render, or any VPS with `pm2 start index.mjs` work the same way.

The worker keeps no local state, so restarting it is always safe. Anything
unsent is still queued in the database.

## Reading the logs

```
09:14:03 sent to Aziza Karimova
09:15:41 quiet hours — holding
09:16:11 daily cap reached (40/40) — holding until tomorrow
09:18:22 flood wait 42s — pausing, message stays queued
```

A `flood wait` is Telegram asking you to slow down. The worker waits it out and
leaves the message queued. If you see them often, widen the gap between
messages in Settings.

Failures are written back to the message, so you see the reason in the app's
Messages screen rather than only here.
