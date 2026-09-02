import type { Language, Student, Tone } from "@/lib/types";

/**
 * Stand-in for the model that will write these messages for real.
 *
 * It composes a message from the same inputs the real prompt will use — the
 * student's name, what they study, how far along they are, the teacher's notes
 * about them, and how long it has been since they last heard anything — so the
 * previews in the nudge builder show the real shape of the output.
 */

function seed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(options: T[], key: string): T {
  return options[seed(key) % options.length];
}

const OPENERS: Record<Language, Record<Tone, string[]>> = {
  en: {
    warm: ["Hi {name}!", "Hey {name},", "{name}, hope your day went well."],
    direct: ["{name} —", "{name}, quick one.", "Morning, {name}."],
    playful: ["{name}! 👋", "Psst, {name} —", "{name}, guess who."],
    formal: ["Dear {name},", "Hello {name},", "Good day, {name}."],
  },
  ru: {
    warm: ["Привет, {name}!", "{name}, добрый день!", "Здравствуй, {name}."],
    direct: ["{name}, коротко.", "{name} —", "Доброе утро, {name}."],
    playful: ["{name}! 👋", "{name}, угадай кто!", "Эй, {name} —"],
    formal: ["Здравствуйте, {name}.", "Добрый день, {name}.", "{name}, приветствую."],
  },
  uz: {
    warm: ["Salom, {name}!", "{name}, kuningiz yaxshi o'tdimi?", "Assalomu alaykum, {name}!"],
    direct: ["{name} —", "{name}, qisqacha.", "Xayrli tong, {name}."],
    playful: ["{name}! 👋", "{name}, kim ekanini top!", "Hoy, {name} —"],
    formal: ["Hurmatli {name},", "Assalomu alaykum, {name}.", "{name}, salom."],
  },
};

const CLOSERS: Record<Language, string[]> = {
  en: ["See you at the lesson.", "Proud of your work.", "You've got this.", "Talk soon."],
  ru: ["Увидимся на занятии.", "Горжусь твоей работой.", "У тебя получится.", "До связи."],
  uz: ["Darsda ko'rishamiz.", "Mehnatingdan faxrlanaman.", "Sen uddalaysan.", "Ko'rishguncha."],
};

/** Turns the teacher's notes into one sentence that only fits this student. */
function personalHook(student: Student, language: Language): string | null {
  const notes = student.aiNotes.toLowerCase();
  const has = (...words: string[]) => words.some((w) => notes.includes(w));

  if (has("shy", "quiet", "стесн", "тих", "uyatchan")) {
    return {
      en: `No pressure — just send me what you managed, even if it's half.`,
      ru: `Без давления — пришли то, что успел, даже наполовину.`,
      uz: `Shoshilma — ulgurganingni yubor, yarmi bo'lsa ham.`,
    }[language];
  }
  if (has("exam", "ielts", "dtm", "экзам", "имтихон", "imtihon")) {
    return {
      en: `Your exam is close, and the work you're putting in now is the part that counts.`,
      ru: `Экзамен близко, и именно эта работа сейчас решает.`,
      uz: `Imtihon yaqin, hozirgi mehnating aynan hal qiladi.`,
    }[language];
  }
  if (has("fast", "strong", "ahead", "силь", "быстр", "kuchli")) {
    return {
      en: `You're ahead of the group — I've set something harder aside for you.`,
      ru: `Ты идёшь впереди группы — я отложил для тебя задание посложнее.`,
      uz: `Guruhdan oldindasan — sen uchun qiyinroq topshiriq ajratdim.`,
    }[language];
  }
  if (has("miss", "late", "absent", "пропус", "опазд", "kechik")) {
    return {
      en: `We've missed you the last couple of sessions — come back this week.`,
      ru: `Тебя не было пару занятий — вернись на этой неделе.`,
      uz: `Oxirgi darslarda yo'q eding — shu hafta qaytib kel.`,
    }[language];
  }
  if (has("homework", "домаш", "uy ishi", "vazifa")) {
    return {
      en: `Start with the homework while it's still fresh from the lesson.`,
      ru: `Начни с домашнего, пока урок ещё свежий.`,
      uz: `Dars esingdaligida uy ishidan boshla.`,
    }[language];
  }
  return null;
}

/** Mentions the gap only when it is real, so the line never rings false. */
function recencyLine(student: Student, language: Language): string | null {
  if (!student.lastContactedAt) return null;
  const days = Math.floor(
    (Date.now() - new Date(student.lastContactedAt).getTime()) / 86_400_000,
  );
  if (days < 7) return null;
  return {
    en: `It's been ${days} days since we spoke.`,
    ru: `Мы не общались уже ${days} дней.`,
    uz: `Gaplashmaganimizga ${days} kun bo'ldi.`,
  }[language];
}

export interface PersonalizeInput {
  student: Student;
  intent: string;
  tone: Tone;
  language: Language;
}

export function personalize({ student, intent, tone, language }: PersonalizeInput): string {
  const key = `${student.id}:${intent}:${tone}:${language}`;
  const firstName = student.name.split(" ")[0];

  const opener = pick(OPENERS[language][tone], key).replace("{name}", firstName);
  const subjectLine = intent.trim()
    ? intent.trim().replace(/\{name\}/gi, firstName).replace(/\{subject\}/gi, student.subject)
    : {
        en: `A quick nudge about ${student.subject}.`,
        ru: `Небольшое напоминание про ${student.subject}.`,
        uz: `${student.subject} bo'yicha eslatma.`,
      }[language];

  const parts = [
    opener,
    subjectLine,
    recencyLine(student, language),
    personalHook(student, language),
    pick(CLOSERS[language], key + ":close"),
  ].filter(Boolean);

  return parts.join(" ");
}

/** The message everyone gets when personalisation is switched off. */
export function plain(intent: string, student: Student): string {
  return intent
    .replace(/\{name\}/gi, student.name.split(" ")[0])
    .replace(/\{subject\}/gi, student.subject);
}
