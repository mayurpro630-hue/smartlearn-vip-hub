import { createServerFn } from "@tanstack/react-start";

/**
 * Server-side voice generation used as a fallback when the browser's own
 * speech synthesis is missing or blocked (common in Android WebViews).
 * Returns a base64 mp3 that the client plays with a normal <audio> element.
 */
export const getSpeechAudio = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string; lang?: string }) => ({
    text: String(data?.text ?? "").slice(0, 400),
    lang: typeof data?.lang === "string" ? data.lang.slice(0, 10) : "en-IN",
  }))
  .handler(async ({ data }) => {
    if (!data.text.trim()) return { ok: false as const, error: "Nothing to read." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "Audio is not configured yet." };

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          voice: "alloy",
          input: data.text,
          instructions: data.lang.startsWith("mr")
            ? "Speak clearly and slowly in Marathi."
            : "Speak clearly and slowly, like a friendly Indian English teacher.",
        }),
      });

      if (!response.ok) {
        console.error("[getSpeechAudio] gateway", response.status, await response.text());
        if (response.status === 429) {
          return { ok: false as const, error: "Too many audio requests. Try again shortly." };
        }
        if (response.status === 402) {
          return { ok: false as const, error: "AI credits are finished, so audio is paused." };
        }
        return { ok: false as const, error: "Could not create the audio." };
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
      return { ok: true as const, audio: `data:audio/mpeg;base64,${btoa(binary)}` };
    } catch (error) {
      console.error("[getSpeechAudio] failed", error);
      return { ok: false as const, error: "Network problem while creating audio." };
    }
  });
