export type ExerciseKind = "mcq" | "match" | "fill_blank" | "audio" | "speak" | "build";

export type Pair = { left: string; right: string };

export type EnglishExercise = {
  id: string;
  lesson_id: string;
  kind: ExerciseKind;
  prompt: string;
  helper_text: string | null;
  options: unknown;
  pairs: unknown;
  correct_answer: string | null;
  audio_text: string | null;
  explanation: string | null;
  position: number;
  prompt_mr?: string | null;
  meaning_mr?: string | null;
  pronunciation_mr?: string | null;
  hint_mr?: string | null;
  media?: string | null;
};

export function asOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function asPairs(value: unknown): Pair[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) =>
    v && typeof v === "object" && "left" in v && "right" in v
      ? [{ left: String((v as Pair).left), right: String((v as Pair).right) }]
      : [],
  );
}

/** Loose comparison so spelling case, punctuation and extra spaces don't fail a learner. */
export function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAnswerCorrect(expected: string | null | undefined, given: string) {
  if (!expected) return false;
  return normalizeAnswer(expected) === normalizeAnswer(given);
}

/** Rough word-overlap score for spoken sentences (0-1). */
export function speechSimilarity(expected: string, given: string) {
  const want = normalizeAnswer(expected).split(" ").filter(Boolean);
  const got = new Set(normalizeAnswer(given).split(" ").filter(Boolean));
  if (want.length === 0) return 0;
  const hits = want.filter((w) => got.has(w)).length;
  return hits / want.length;
}

/** Stable-ish shuffle so the order doesn't jump on every re-render. */
export function shuffle<T>(items: T[], seed = 1): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Word tiles for a sentence-building exercise. */
export function sentenceTiles(sentence: string, seed = 7) {
  return shuffle(
    sentence
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean),
    seed,
  );
}

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function getRecognition(lang = "en-IN") {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  return rec;
}

export const LEVEL_ACCENT: Record<number, string> = {
  1: "from-primary/25 to-primary/5",
  2: "from-emerald-500/25 to-emerald-500/5",
  3: "from-amber-500/25 to-amber-500/5",
  4: "from-fuchsia-500/25 to-fuchsia-500/5",
};
