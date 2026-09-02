import type { ToolSpec } from "./providers/types";

/**
 * What the assistant is allowed to do inside Labbay.
 *
 * The schemas live here and the implementations live in `execute.ts`, which
 * runs in the browser because that is where the data is. Everything the
 * assistant can change, the teacher can also change by hand.
 */
export const ASSISTANT_TOOLS: ToolSpec[] = [
  {
    name: "get_overview",
    description:
      "Current state of the whole app: student counts, active nudges, messages sent and queued, autopilot and Telegram status, and which students have gone quiet. Call this first when the teacher asks anything general.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_students",
    description:
      "List students with their group, level, notes, status, and how long since they last heard from the teacher.",
    input_schema: {
      type: "object",
      properties: {
        group: { type: "string", description: "Only this group." },
        status: { type: "string", enum: ["active", "paused"] },
        quiet_for_days: {
          type: "number",
          description: "Only students silent at least this many days.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_courses",
    description:
      "All courses, group and individual: name, kind, dates, final exam, fee, how many students, and how much has been collected.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_payments",
    description:
      "What one student has paid: every payment with its date and amount, plus what is still owed on their course fee.",
    input_schema: {
      type: "object",
      properties: { student_name: { type: "string" } },
      required: ["student_name"],
      additionalProperties: false,
    },
  },
  {
    name: "list_nudges",
    description:
      "List scheduled nudges: name, days, time, audience, tone, and whether each is active.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_messages",
    description: "Recent messages, newest first, with their exact text and status.",
    input_schema: {
      type: "object",
      properties: {
        student_name: { type: "string" },
        status: { type: "string", enum: ["sent", "queued", "failed"] },
        limit: { type: "number", description: "Default 20, max 60." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "send_message",
    description:
      "Send a message to students right now. Describe the point in `intent` — each student gets their own wording when personalize is true. Confirm with the teacher before using this unless they clearly asked you to send.",
    input_schema: {
      type: "object",
      properties: {
        audience: {
          type: "string",
          description:
            "'all', a group name, or a comma-separated list of student names.",
        },
        intent: {
          type: "string",
          description: "What the message should get across, in plain words.",
        },
        tone: { type: "string", enum: ["warm", "direct", "playful", "formal"] },
        personalize: { type: "boolean", description: "Default true." },
      },
      required: ["audience", "intent"],
      additionalProperties: false,
    },
  },
  {
    name: "create_nudge",
    description:
      "Create a scheduled nudge that sends itself on the chosen weekdays at the chosen time.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        audience: {
          type: "string",
          description: "'all', a group name, or comma-separated student names.",
        },
        days: {
          type: "array",
          items: { type: "number" },
          description: "Weekdays, 0 = Monday through 6 = Sunday.",
        },
        hour: { type: "number" },
        minute: { type: "number" },
        intent: { type: "string" },
        tone: { type: "string", enum: ["warm", "direct", "playful", "formal"] },
      },
      required: ["name", "audience", "days", "hour", "minute", "intent"],
      additionalProperties: false,
    },
  },
  {
    name: "set_nudge_status",
    description: "Pause or resume a nudge by name.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        status: { type: "string", enum: ["active", "paused"] },
      },
      required: ["name", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "update_student",
    description:
      "Change a student's notes for the agent, group, level, or status. Match on name.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        ai_notes: { type: "string" },
        group: { type: "string" },
        level: { type: "string" },
        status: { type: "string", enum: ["active", "paused"] },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "set_autopilot",
    description:
      "Turn autopilot on or off. When on, due nudges send themselves without the teacher pressing anything.",
    input_schema: {
      type: "object",
      properties: { enabled: { type: "boolean" } },
      required: ["enabled"],
      additionalProperties: false,
    },
  },
];

export const ASSISTANT_SYSTEM = `You are the assistant inside Labbay, an app a private tutor uses to keep in touch with their students.

You are talking to the teacher who owns the app, not to a student.

What you can do:
- Answer questions about their students, nudges, and messages by calling tools.
- Operate the app for them: send messages, create and pause nudges, edit student notes, switch autopilot on or off.
- Answer money questions: who has paid, who still owes, how much a course has collected. Amounts are Uzbek so'm.
- Act as a general assistant when they ask something unrelated to the app — answer directly, no tools needed.

How to behave:
- Call get_overview before answering broad questions like "how are things" or "who needs attention".
- Before sending anything or creating a nudge, say what you are about to do and get a yes — unless the teacher's message already is the instruction ("send everyone a reminder about homework" is an instruction; "should I remind them?" is not).
- After a tool changes something, say plainly what changed.
- Write the way a sharp colleague talks: short sentences, no filler, no bullet lists unless they genuinely help. Never open with a compliment.
- The teacher's students are in Uzbekistan and study English or maths. Names are Uzbek. Keep that in mind when you draft message wording.`;
