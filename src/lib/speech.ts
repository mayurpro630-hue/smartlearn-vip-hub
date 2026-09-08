import { getSpeechAudio } from "@/lib/tts.functions";

/**
 * Robust "Listen" support.
 * 1. Try the browser's own voice (fast, free, offline).
 * 2. If it is missing or silently blocked, fall back to server-generated audio.
 */

const cache = new Map<string, string>();
let audioEl: HTMLAudioElement | null = null;
let warmed = false;

function hasSynth() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Call once from a real user gesture so mobile browsers allow audio later. */
export function warmUpAudio() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  try {
    if (hasSynth()) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      window.speechSynthesis.getVoices();
    }
  } catch {
    /* ignore */
  }
}

function pickVoice(lang: string) {
  if (!hasSynth()) return null;
  const voices = window.speechSynthesis.getVoices() ?? [];
  const base = lang.split("-")[0]!;
  return (
    voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith(base)) ??
    null
  );
}

function browserSpeak(text: string, lang: string) {
  return new Promise<boolean>((resolve) => {
    if (!hasSynth()) {
      resolve(false);
      return;
    }
    let settled = false;
    const done = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 0.85;
      const voice = pickVoice(lang);
      if (voice) utter.voice = voice;
      utter.onstart = () => done(true);
      utter.onerror = () => done(false);
      utter.onend = () => done(true);
      window.speechSynthesis.speak(utter);
      // Some Android WebViews accept the call but never speak — treat silence as failure.
      window.setTimeout(() => {
        if (!settled && !window.speechSynthesis.speaking) done(false);
        else done(true);
      }, 900);
    } catch {
      done(false);
    }
  });
}

async function serverSpeak(text: string, lang: string) {
  const key = `${lang}::${text}`;
  let src = cache.get(key);
  if (!src) {
    const res = await getSpeechAudio({ data: { text, lang } });
    if (!res.ok) return { ok: false as const, error: res.error };
    src = res.audio;
    cache.set(key, src);
  }
  try {
    audioEl?.pause();
    audioEl = new Audio(src);
    await audioEl.play();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Your browser blocked audio playback. Tap again." };
  }
}

/** Speaks the text and returns an error message only when nothing could play. */
export async function speakSmart(text: string, lang = "en-IN"): Promise<string | null> {
  const clean = text.trim().slice(0, 400);
  if (!clean) return null;
  warmUpAudio();
  if (await browserSpeak(clean, lang)) return null;
  const fallback = await serverSpeak(clean, lang);
  return fallback.ok ? null : fallback.error;
}

export function stopSpeaking() {
  try {
    if (hasSynth()) window.speechSynthesis.cancel();
    audioEl?.pause();
  } catch {
    /* ignore */
  }
}
