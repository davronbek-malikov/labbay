/**
 * Spotting things that already exist under a slightly different name.
 *
 * Teachers type "IELTS evening", "ielts-evening" and "Evening IELTS" on
 * different days and end up with three courses that are really one. This
 * catches that before it happens, without ever blocking the teacher.
 */

/** Words that carry no meaning when comparing two course names. */
const NOISE = new Set([
  "the",
  "a",
  "an",
  "and",
  "for",
  "of",
  "class",
  "course",
  "group",
  "lesson",
  "lessons",
  "students",
]);

export function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string): string[] {
  return normalise(value)
    .split(" ")
    .filter((t) => t && !NOISE.has(t));
}

/** Classic edit distance, capped so long strings stay cheap. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** The numbers in a name, which usually say which one it is. */
function numbers(value: string): string {
  return (normalise(value).match(/\d+/g) ?? []).join(",");
}

/** 0 = nothing alike, 1 = the same thing. */
export function similarity(a: string, b: string): number {
  const left = normalise(a);
  const right = normalise(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  // "Grade 10" and "Grade 11" are two courses, not one. When both names carry
  // numbers and they disagree, the rest of the name barely matters.
  const leftNumbers = numbers(a);
  const rightNumbers = numbers(b);
  if (leftNumbers && rightNumbers && leftNumbers !== rightNumbers) return 0.2;

  // Same words in a different order — "evening IELTS" vs "IELTS evening".
  const leftTokens = new Set(tokens(a));
  const rightTokens = new Set(tokens(b));
  if (leftTokens.size && rightTokens.size) {
    const shared = [...leftTokens].filter((t) => rightTokens.has(t)).length;
    const overlap = shared / Math.max(leftTokens.size, rightTokens.size);
    if (overlap === 1) return 0.97;
    if (overlap >= 0.5) {
      // Partial overlap still counts, but never as strongly as a full match.
      const spelling =
        1 - distance(left, right) / Math.max(left.length, right.length);
      return Math.max(overlap * 0.9, spelling);
    }
  }

  // Otherwise judge on spelling alone, which catches typos.
  return 1 - distance(left, right) / Math.max(left.length, right.length);
}

/** Anything at or above this is worth warning about. */
export const SIMILAR_ENOUGH = 0.72;

export interface Match<T> {
  item: T;
  score: number;
  /** True when the names are effectively identical. */
  exact: boolean;
}

/**
 * The existing entries a new name looks like, strongest first.
 *
 * `skipId` leaves out the record being edited, so renaming something does not
 * warn about itself.
 */
export function findSimilar<T extends { id: string; name: string }>(
  name: string,
  items: T[],
  { skipId, threshold = SIMILAR_ENOUGH }: { skipId?: string; threshold?: number } = {},
): Match<T>[] {
  const candidate = name.trim();
  if (candidate.length < 2) return [];

  return items
    .filter((i) => i.id !== skipId)
    .map((item) => {
      const score = similarity(candidate, item.name);
      return { item, score, exact: normalise(candidate) === normalise(item.name) };
    })
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
