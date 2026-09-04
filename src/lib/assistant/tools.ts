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
    name: "navigate_to",
    description:
      "Take the teacher to a screen in the app. Use it whenever they ask where something is or how to reach it. Screens: dashboard (Today), assistant, courses, students, send (Send now), nudges, messages, settings. Ask first unless they clearly said take me there.",
    input_schema: {
      type: "object",
      properties: {
        screen: {
          type: "string",
          enum: [
            "dashboard",
            "assistant",
            "courses",
            "students",
            "send",
            "nudges",
            "messages",
            "settings",
          ],
        },
        reason: {
          type: "string",
          description: "One short line telling them what they will find there.",
        },
      },
      required: ["screen"],
      additionalProperties: false,
    },
  },
  {
    name: "add_student",
    description:
      "Add a student. Only the name is required; a course is optional and can be set later.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        telegram: { type: "string", description: "@username, or a phone number." },
        course: { type: "string", description: "Name of an existing course." },
        subject: { type: "string" },
        level: { type: "string" },
        ai_notes: { type: "string", description: "What you should know when writing to them." },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_student",
    description:
      "Permanently remove a student and their payment history. Always confirm with the teacher first.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "create_course",
    description:
      "Create a course. A group course teaches many students; an individual course teaches one.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        kind: { type: "string", enum: ["group", "individual"] },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
        final_exam_date: { type: "string", description: "YYYY-MM-DD" },
        fee: { type: "number", description: "What one student pays in total." },
        currency: { type: "string", enum: ["UZS", "USD", "KRW"] },
        topics: { type: "array", items: { type: "string" } },
        homework: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_course",
    description:
      "Change a course by name: its dates, exam, fee, topics, homework, or notes. Passing topics or homework replaces the whole list.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The course to change." },
        new_name: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        final_exam_date: { type: "string" },
        fee: { type: "number" },
        currency: { type: "string", enum: ["UZS", "USD", "KRW"] },
        topics: { type: "array", items: { type: "string" } },
        add_topics: {
          type: "array",
          items: { type: "string" },
          description: "Append these instead of replacing the list.",
        },
        homework: { type: "array", items: { type: "string" } },
        add_homework: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_course",
    description:
      "Delete a course. Its students stay but end up with no course. Always confirm first.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "record_payment",
    description: "Record money a student has paid towards their course fee.",
    input_schema: {
      type: "object",
      properties: {
        student_name: { type: "string" },
        amount: { type: "number" },
        paid_at: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        note: { type: "string" },
      },
      required: ["student_name", "amount"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_nudge",
    description: "Delete a scheduled nudge by name. Confirm first.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_syllabus",
    description:
      "The course plan: every level, its lessons, and the topics and homework in each. Call before changing it so you build on what is there.",
    input_schema: {
      type: "object",
      properties: { course: { type: "string" } },
      required: ["course"],
      additionalProperties: false,
    },
  },
  {
    name: "set_syllabus",
    description:
      "Replace a course's whole plan. Levels are named freely by the teacher (A1, Beginner, Unit 3, Term 1). Always call get_syllabus first and send the full list back, including anything you are keeping, because this overwrites.",
    input_schema: {
      type: "object",
      properties: {
        course: { type: "string" },
        levels: {
          type: "array",
          description: "The levels, in the order they are taught.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              lessons: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    topics: { type: "array", items: { type: "string" } },
                    homework: { type: "array", items: { type: "string" } },
                  },
                  required: ["title"],
                },
              },
            },
            required: ["name"],
          },
        },
      },
      required: ["course", "levels"],
      additionalProperties: false,
    },
  },
  {
    name: "set_student_fields",
    description:
      "Set the teacher's own fields on a student — parent's phone, school, target band, anything. Only the keys you send are changed; send an empty string to clear one.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        fields: {
          type: "object",
          description: "Field name to value, e.g. {\"School\": \"Lyceum 3\"}.",
        },
      },
      required: ["name", "fields"],
      additionalProperties: false,
    },
  },
  {
    name: "list_exams",
    description:
      "Courses with a final exam coming up, how many days away it is, who is on them, and whether the teacher has acknowledged it yet.",
    input_schema: {
      type: "object",
      properties: {
        within_days: { type: "number", description: "Default 14." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "acknowledge_exam",
    description:
      "Marks a course's exam reminder as seen, so the red alert on the home screen stops showing for that date.",
    input_schema: {
      type: "object",
      properties: { course: { type: "string" } },
      required: ["course"],
      additionalProperties: false,
    },
  },
  {
    name: "get_money",
    description:
      "Income and expenses over the last N days: student fees collected, other income, expenses, and the net. Use for any question about earnings, spending, or profit.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Window in days. Default 30." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "add_transaction",
    description:
      "Record money in or out that is NOT a student course fee — rent, transport, books, a one-off private lesson. Student fees go through record_payment instead.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["income", "expense"] },
        amount: { type: "number" },
        currency: { type: "string", enum: ["UZS", "USD", "KRW"] },
        category: { type: "string", description: "Rent, transport, books…" },
        note: { type: "string" },
        occurred_at: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
      },
      required: ["kind", "amount"],
      additionalProperties: false,
    },
  },
  {
    name: "list_transactions",
    description: "Recent income and expense entries, newest first.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["income", "expense"] },
        limit: { type: "number", description: "Default 20." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "delete_transaction",
    description:
      "Remove an income or expense entry. Match it by its category and amount; confirm with the teacher first.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string" },
        amount: { type: "number" },
      },
      required: ["category"],
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
- Operate the app for them: add, edit and remove students and courses, record payments, send messages, create, pause and delete nudges, switch autopilot on or off.
- Take them to any screen with navigate_to when they ask where something is or how to get there.
- Build and edit the course plan: levels, the lessons in them, topics and homework. Teachers name levels however they like.
- Keep the teacher's own fields on each student up to date.
- Answer money questions: who has paid, who still owes, how much a course has collected, and what the teacher earned or spent.
- Record income and expenses when asked ("I paid 200000 for books", "add 500000 income from a private lesson").
- Amounts default to Uzbek so'm unless the course or the teacher says otherwise.
- Act as a general assistant when they ask something unrelated to the app — answer directly, no tools needed.

How to behave:
- When they ask where something is, or how to do something, answer briefly and then offer to take them: "Settings is where you control sending. Shall I open it?" If they say yes, or they already said something like "take me there", call navigate_to.
- Anything that deletes needs an explicit yes first. Say exactly what will be lost.
- Call get_overview before answering broad questions like "how are things" or "who needs attention".
- Before sending anything or creating a nudge, say what you are about to do and get a yes — unless the teacher's message already is the instruction ("send everyone a reminder about homework" is an instruction; "should I remind them?" is not).
- After a tool changes something, say plainly what changed.
- Write the way a sharp colleague talks: short sentences, no filler, no bullet lists unless they genuinely help. Never open with a compliment.
- The teacher's students are in Uzbekistan and study English or maths. Names are Uzbek. Keep that in mind when you draft message wording.`;
