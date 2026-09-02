import type {
  Database,
  Group,
  Message,
  Nudge,
  Payment,
  Student,
} from "@/lib/types";

const now = Date.now();
const day = 86_400_000;
const iso = (offsetDays: number, hour = 19, minute = 0) => {
  const d = new Date(now - offsetDays * day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const dateOnly = (offsetDays: number) =>
  new Date(now - offsetDays * day).toISOString().slice(0, 10);

const groups: Group[] = [
  {
    id: "gr_ielts",
    name: "IELTS evening",
    kind: "group",
    startDate: dateOnly(60),
    endDate: dateOnly(-60),
    finalExamDate: dateOnly(-52),
    fee: 1_200_000,
    currency: "UZS",
    createdAt: iso(60),
  },
  {
    id: "gr_dtm",
    name: "DTM maths",
    kind: "group",
    startDate: dateOnly(120),
    endDate: dateOnly(-30),
    finalExamDate: dateOnly(-25),
    fee: 900_000,
    currency: "UZS",
    createdAt: iso(120),
  },
  {
    id: "gr_beginners",
    name: "Beginners A2",
    kind: "group",
    startDate: dateOnly(30),
    endDate: dateOnly(-90),
    finalExamDate: dateOnly(-85),
    fee: 700_000,
    currency: "UZS",
    createdAt: iso(30),
  },
  {
    id: "gr_jasur",
    name: "Jasur — private maths",
    kind: "individual",
    startDate: dateOnly(45),
    endDate: dateOnly(-45),
    finalExamDate: dateOnly(-40),
    fee: 2_000_000,
    currency: "UZS",
    createdAt: iso(45),
  },
  {
    id: "gr_nilufar",
    name: "Nilufar — IELTS one to one",
    kind: "individual",
    startDate: dateOnly(20),
    endDate: dateOnly(-70),
    finalExamDate: dateOnly(-64),
    fee: 2_400_000,
    currency: "UZS",
    createdAt: iso(20),
  },
];

const students: Student[] = [
  {
    id: "st_aziza",
    name: "Aziza Karimova",
    telegram: "@aziza_k",
    subject: "English",
    groupId: "gr_ielts",
    level: "B2",
    aiNotes: "Preparing for IELTS in November. Strong writing, avoids speaking.",
    status: "active",
    lastContactedAt: iso(2),
    createdAt: iso(120),
  },
  {
    id: "st_bekzod",
    name: "Bekzod Rasulov",
    telegram: "@bek_rasulov",
    subject: "English",
    groupId: "gr_ielts",
    level: "B1",
    aiNotes:
      "Misses homework when football season starts. Responds to short, direct messages.",
    status: "active",
    lastContactedAt: iso(9),
    createdAt: iso(96),
  },
  {
    id: "st_dilnoza",
    name: "Dilnoza Yusupova",
    telegram: "@dilnoza_y",
    subject: "Mathematics",
    groupId: "gr_dtm",
    level: "Grade 11",
    aiNotes: "Shy, rarely asks questions. Needs gentle encouragement, not pressure.",
    status: "active",
    lastContactedAt: iso(1),
    createdAt: iso(210),
  },
  {
    id: "st_jasur",
    name: "Jasur Toshev",
    telegram: "+998901234567",
    subject: "Mathematics",
    groupId: "gr_jasur",
    level: "Grade 11",
    aiNotes: "Fastest in the group, gets bored. Give him harder problems.",
    status: "active",
    lastContactedAt: iso(3),
    createdAt: iso(180),
  },
  {
    id: "st_madina",
    name: "Madina Alimova",
    telegram: "@madina_a",
    subject: "English",
    groupId: "gr_beginners",
    level: "A2",
    aiNotes:
      "New student, still nervous. Confidence matters more than accuracy right now.",
    status: "active",
    lastContactedAt: iso(4),
    createdAt: iso(28),
  },
  {
    id: "st_ravshan",
    name: "Ravshan Umarov",
    telegram: "@ravshan_u",
    subject: "English",
    groupId: "gr_beginners",
    level: "A2",
    aiNotes: "Missed the last two lessons. Works evenings, often late.",
    status: "active",
    lastContactedAt: iso(14),
    createdAt: iso(60),
  },
  {
    id: "st_nilufar",
    name: "Nilufar Sobirova",
    telegram: "@nilufar_s",
    subject: "English",
    groupId: "gr_nilufar",
    level: "B2",
    aiNotes: "Wants band 7. Very organised, likes a clear weekly plan.",
    status: "active",
    lastContactedAt: iso(2),
    createdAt: iso(150),
  },
  {
    id: "st_sardor",
    name: "Sardor Nazarov",
    telegram: "@sardor_n",
    subject: "Mathematics",
    groupId: "gr_dtm",
    level: "Grade 10",
    aiNotes: "Good at algebra, weak on geometry. Homework often half-finished.",
    status: "active",
    lastContactedAt: iso(6),
    createdAt: iso(88),
  },
  {
    id: "st_kamola",
    name: "Kamola Ergasheva",
    telegram: "@kamola_e",
    subject: "English",
    groupId: "gr_beginners",
    level: "A1",
    aiNotes: "Youngest in the group. Playful tone works best.",
    status: "active",
    lastContactedAt: iso(5),
    createdAt: iso(40),
  },
  {
    id: "st_otabek",
    name: "Otabek Yuldoshev",
    telegram: "@otabek_y",
    subject: "Mathematics",
    groupId: "gr_dtm",
    level: "Grade 11",
    aiNotes: "Exam in December. Panics under time pressure.",
    status: "active",
    lastContactedAt: iso(3),
    createdAt: iso(200),
  },
  {
    id: "st_zilola",
    name: "Zilola Mirzayeva",
    telegram: "@zilola_m",
    subject: "English",
    groupId: "gr_ielts",
    level: "B1",
    aiNotes: "Reading is strong, listening is weak. Needs daily short practice.",
    status: "active",
    lastContactedAt: iso(8),
    createdAt: iso(110),
  },
  {
    id: "st_farrux",
    name: "Farrux Qodirov",
    telegram: "@farrux_q",
    subject: "English",
    groupId: "gr_beginners",
    level: "A2",
    aiNotes: "Travels for work, joins online half the time.",
    status: "paused",
    lastContactedAt: iso(31),
    createdAt: iso(75),
  },
  {
    id: "st_shahnoza",
    name: "Shahnoza Tursunova",
    telegram: "@shahnoza_t",
    subject: "Mathematics",
    groupId: "gr_dtm",
    level: "Grade 10",
    aiNotes: "Very consistent. Rarely needs chasing, but likes being noticed.",
    status: "active",
    lastContactedAt: iso(2),
    createdAt: iso(130),
  },
  {
    id: "st_ulugbek",
    name: "Ulugbek Sattorov",
    telegram: "@ulugbek_s",
    subject: "English",
    groupId: "gr_ielts",
    level: "B2",
    aiNotes: "Speaking is confident, writing task 2 is the gap.",
    status: "active",
    lastContactedAt: iso(7),
    createdAt: iso(140),
  },
  {
    id: "st_gulnora",
    name: "Gulnora Ismoilova",
    telegram: "@gulnora_i",
    subject: "English",
    groupId: "gr_beginners",
    level: "A1",
    aiNotes: "Mother of two, studies late at night. Never message before 20:00.",
    status: "active",
    lastContactedAt: iso(4),
    createdAt: iso(52),
  },
];

const nudges: Nudge[] = [
  {
    id: "nd_homework",
    name: "Homework check-in",
    audience: { kind: "all" },
    days: [1, 3],
    hour: 19,
    minute: 30,
    intent:
      "Ask how the homework is going and remind them it is due before the next lesson.",
    tone: "warm",
    channel: "text",
    personalize: true,
    status: "active",
    createdAt: iso(45),
  },
  {
    id: "nd_ielts",
    name: "IELTS Monday push",
    audience: { kind: "group", groupId: "gr_ielts" },
    days: [0],
    hour: 9,
    minute: 0,
    intent: "Set the tone for the week and name one thing to focus on.",
    tone: "direct",
    channel: "text",
    personalize: true,
    status: "active",
    createdAt: iso(30),
  },
  {
    id: "nd_friday",
    name: "Friday well done",
    audience: { kind: "all" },
    days: [4],
    hour: 18,
    minute: 0,
    intent: "Thank them for the week's work and tell them to rest properly.",
    tone: "playful",
    channel: "text",
    personalize: true,
    status: "active",
    createdAt: iso(20),
  },
  {
    id: "nd_comeback",
    name: "Come back to class",
    audience: { kind: "picked", studentIds: ["st_ravshan", "st_farrux"] },
    days: [2],
    hour: 20,
    minute: 15,
    intent: "Tell them they were missed and ask which day suits them this week.",
    tone: "warm",
    channel: "text",
    personalize: true,
    status: "paused",
    createdAt: iso(12),
  },
];

const SAMPLES: Array<[string, string, string]> = [
  [
    "st_aziza",
    "nd_homework",
    "Hi Aziza! Ask how the homework is going and remind them it is due before the next lesson. Your exam is close, and the work you're putting in now is the part that counts. Proud of your work.",
  ],
  [
    "st_dilnoza",
    "nd_homework",
    "Hi Dilnoza! Ask how the homework is going and remind them it is due before the next lesson. No pressure — just send me what you managed, even if it's half. You've got this.",
  ],
  [
    "st_jasur",
    "nd_homework",
    "Jasur — Ask how the homework is going and remind them it is due before the next lesson. You're ahead of the group — I've set something harder aside for you. See you at the lesson.",
  ],
  [
    "st_bekzod",
    "nd_homework",
    "Bekzod, quick one. Ask how the homework is going and remind them it is due before the next lesson. Start with the homework while it's still fresh from the lesson. Talk soon.",
  ],
  [
    "st_nilufar",
    "nd_ielts",
    "Nilufar — Set the tone for the week and name one thing to focus on. Your exam is close, and the work you're putting in now is the part that counts. See you at the lesson.",
  ],
  [
    "st_ulugbek",
    "nd_ielts",
    "Ulugbek, quick one. Set the tone for the week and name one thing to focus on. Talk soon.",
  ],
  [
    "st_zilola",
    "nd_ielts",
    "Zilola — Set the tone for the week and name one thing to focus on. It's been 8 days since we spoke. You've got this.",
  ],
  [
    "st_kamola",
    "nd_friday",
    "Kamola! 👋 Thank them for the week's work and tell them to rest properly. Proud of your work.",
  ],
  [
    "st_madina",
    "nd_friday",
    "Psst, Madina — Thank them for the week's work and tell them to rest properly. You've got this.",
  ],
  [
    "st_sardor",
    "nd_friday",
    "Sardor! 👋 Thank them for the week's work and tell them to rest properly. Start with the homework while it's still fresh from the lesson. Talk soon.",
  ],
  [
    "st_otabek",
    "nd_homework",
    "Hi Otabek! Ask how the homework is going and remind them it is due before the next lesson. Your exam is close, and the work you're putting in now is the part that counts. You've got this.",
  ],
  [
    "st_shahnoza",
    "nd_friday",
    "Shahnoza! 👋 Thank them for the week's work and tell them to rest properly. See you at the lesson.",
  ],
  [
    "st_gulnora",
    "nd_homework",
    "Hi Gulnora! Ask how the homework is going and remind them it is due before the next lesson. Talk soon.",
  ],
  [
    "st_ravshan",
    "nd_comeback",
    "Hey Ravshan, Tell them they were missed and ask which day suits them this week. We've missed you the last couple of sessions — come back this week. Talk soon.",
  ],
];

const messages: Message[] = [];
let counter = 0;
for (let week = 0; week < 4; week++) {
  for (const [studentId, nudgeId, text] of SAMPLES) {
    const offset = week * 7 + (counter % 5);
    const sent = iso(offset, 19, 30);
    const failed = counter % 17 === 5;
    messages.push({
      id: `msg_${counter}`,
      studentId,
      nudgeId,
      text,
      status: failed ? "failed" : "sent",
      channel: "text",
      scheduledAt: sent,
      sentAt: failed ? null : sent,
      ...(failed
        ? { error: "Student has not opened a chat with this account" }
        : {}),
    });
    counter++;
  }
}

// A few still waiting to go out tonight.
for (const [studentId, nudgeId, text] of SAMPLES.slice(0, 4)) {
  const d = new Date();
  d.setHours(19, 30, 0, 0);
  messages.push({
    id: `msg_${counter++}`,
    studentId,
    nudgeId,
    text,
    status: "queued",
    channel: "text",
    scheduledAt: d.toISOString(),
    sentAt: null,
  });
}

// A realistic spread: some paid in full, some part-paid, one who has not paid.
const PAY: Array<[string, number, number]> = [
  ["st_aziza", 1_200_000, 55],
  ["st_bekzod", 600_000, 50],
  ["st_bekzod", 600_000, 20],
  ["st_dilnoza", 900_000, 110],
  ["st_jasur", 1_000_000, 40],
  ["st_jasur", 1_000_000, 10],
  ["st_madina", 350_000, 25],
  ["st_nilufar", 2_400_000, 18],
  ["st_sardor", 450_000, 80],
  ["st_kamola", 700_000, 35],
  ["st_otabek", 900_000, 100],
  ["st_zilola", 600_000, 40],
  ["st_shahnoza", 900_000, 125],
  ["st_ulugbek", 1_200_000, 60],
  ["st_gulnora", 350_000, 45],
];

const payments: Payment[] = PAY.map(([studentId, amount, ago], i) => ({
  id: `pay_${i}`,
  studentId,
  amount,
  paidAt: dateOnly(ago),
  note: "",
  createdAt: iso(ago),
}));

export const seedDatabase: Database = {
  groups,
  payments,
  students,
  nudges,
  messages,
  settings: {
    teacherName: "Davronbek",
    telegramPhone: "+998 90 123 45 67",
    telegramConnected: false,
    delayMinSeconds: 45,
    delayMaxSeconds: 180,
    dailyCap: 40,
    quietHoursStart: 22,
    quietHoursEnd: 8,
    defaultTone: "warm",
    language: "en",
    autopilot: true,
    lastAutoRunAt: null,
    deliveryMode: "simulate",
    workerSeenAt: null,
  },
};
