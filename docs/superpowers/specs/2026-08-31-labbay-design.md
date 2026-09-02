# Labbay — design spec

**Date:** 2026-08-31
**Status:** Function 1 teacher-side UI built. Sending, scheduling, auth, and Function 2 not started.

## What this is

A helper for private tutors (repetitors). The tutor teaches; Labbay keeps every
student hearing from them between lessons.

## Why it is different

Existing tutor software — TutorBird, Teachworks, TutorCruncher, and in the CIS
market Urokly, AlfaCRM, Paraplan — is scheduling and billing software. Their
automated messages are logistics: *"your lesson is at 15:00"*, *"payment due"*.

Nobody sends motivation, and nobody personalises per student. Labbay's wedge is
an agent that writes a **different** message to each student, conditioned on
what the teacher knows about them.

## Telegram delivery — decision and consequences

Messages send from the **teacher's own Telegram account** over MTProto, so
students see them arriving from their teacher personally.

This was chosen with the trade-offs on the table:

- Telegram throttles and can ban accounts that automate through the user API,
  and bulk unsolicited messaging breaches its terms. The risk lands on the
  teacher's personal account.
- The official Bot API carries no such risk, but a bot cannot open a chat — the
  student must press START via a deep link first — and messages arrive from a
  bot rather than the teacher.

Two consequences are designed in rather than deferred:

1. **Sending cannot run on Vercel alone.** An MTProto session is a long-lived
   connection and cannot live in a serverless function. Production is Vercel for
   the UI plus an always-on worker (Railway / Fly.io / VPS) holding the session.
2. **Safety controls are real UI**, not decoration: randomised gap between
   sends, a daily cap, and quiet hours — all in Settings, and the nudge builder
   warns when a send time falls inside quiet hours.

Sending sits behind a `MessageProvider` interface, so moving to the Bot API
later means writing one file, not a refactor.

## Data model

| Object | Fields |
|---|---|
| `Student` | name, telegram (`@handle` or phone), subject, group, level, `aiNotes`, status, `lastContactedAt` |
| `Nudge` | name, audience (all / group / picked), days[], hour, minute, intent, tone, channel, personalize, status |
| `Message` | studentId, nudgeId, text, status (queued/sent/failed), channel, scheduledAt, sentAt, error |
| `Settings` | teacher name, telegram phone + connected, delay min/max, daily cap, quiet hours, default tone, language |

`aiNotes` is the field that makes the product feel smart — it is what the agent
conditions on when writing.

## Screens

1. **Today** — stat row, the week strip, *Gone quiet* (students silent 7+ days),
   *Going out tonight*, nudges at a glance, recent activity.
2. **Students** — search, group and status filters, bulk select, add/edit drawer.
3. **Nudges** — list with pause / resume / duplicate / delete, plus a four-step
   builder: Audience → Schedule → Message → Preview.
4. **Messages** — every message with its exact wording, filters, detail drawer,
   resend on failure.
5. **Settings** — Telegram connect flow, sending limits, writing defaults, reset.

## Design direction

**Concept: "the register"** — the tutor's ruled attendance book, names down and
marks across.

- **Signature:** the *week strip* — seven cells appearing in three places with
  three true meanings: which days a nudge fires, this week's send rhythm, and as
  the day picker in the builder. One object, consistently meaningful.
- **Palette:** white ground, ink `#14181A`, muted `#6B7480`, hairline `#E7E9EB`,
  accent `#0E7C6B` (Samarkand tilework, deliberately not SaaS blue or Telegram
  blue), clay `#C2571F` for needs-attention.
- **Type:** SF / Inter, personality carried by weight contrast (200↔700) and
  tight display tracking. **All numbers set in mono** — times, counts, phone
  numbers — because the app is mostly data.
- **Restraint:** no gradients, one shadow (floating surfaces only), and stat
  tiles are a number plus a label with no box and no icon.

## Architecture

```
src/lib/types.ts          shared domain types
src/lib/store/
  repository.ts           interface the UI is written against
  localStore.ts           today: browser storage
  StoreProvider.tsx       React context over the repository
src/lib/messaging/
  provider.ts             MessageProvider interface
  mock.ts                 today: sends nothing
src/lib/ai/personalize.ts stand-in for the model that writes the messages
src/app/{dashboard,students,nudges,messages,settings}
```

Only the two adapter files change when the real database and the real Telegram
worker arrive.

## Not built

Real sending · scheduler · auth and multi-teacher · Supabase · voice messages ·
Function 2 (RAG chatbot for students) · student-facing app.

## Next

1. Supabase behind `Repository`, plus teacher accounts.
2. The MTProto worker behind `MessageProvider`, honouring the safety settings.
3. A scheduler that turns active nudges into queued messages.
4. Swap the personalisation stand-in for a real model call.
