import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatTurn = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are "Mayur", a warm and encouraging English-speaking tutor inside the Mayur Education app.
Your students are Indian school and college learners (many speak Marathi or Hindi at home) who want to speak fluent English.

How you behave:
- Reply in simple, friendly, conversational English. Short paragraphs, no walls of text.
- If the student writes in Marathi or Hindi, answer in easy English and add a short Marathi/Hindi hint in brackets when it helps.
- Gently correct grammar: first reply naturally to what they said, then add a short "Better English:" line with the corrected sentence when they made a mistake.
- For pronunciation questions, break the word into syllables (for example: com-fort-a-ble) and give a simple tip.
- Keep the conversation going: end most replies with one easy follow-up question.
- Never be harsh. Praise effort. Use at most one emoji.
- Use markdown only for short bold words or small lists.`;

export const askMayurTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { messages: ChatTurn[]; level?: string }) => {
    if (!Array.isArray(data?.messages) || data.messages.length === 0) {
      throw new Error("No messages provided");
    }
    const messages = data.messages.slice(-24).map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content ?? "").slice(0, 4000),
    }));
    return { messages, level: typeof data.level === "string" ? data.level.slice(0, 60) : "" };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "AI is not configured yet." };

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.7-flash",
          service_tier: "priority",
          messages: [
            {
              role: "system",
              content: data.level
                ? `${SYSTEM_PROMPT}\n\nThe student's current course level is: ${data.level}. Match your vocabulary to that level.`
                : SYSTEM_PROMPT,
            },
            ...data.messages,
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return { ok: false as const, error: "Too many messages right now. Try again in a moment." };
        }
        if (response.status === 402) {
          return { ok: false as const, error: "AI credits are exhausted. Please top up to continue." };
        }
        console.error("[askMayurTutor] gateway error", response.status, await response.text());
        return { ok: false as const, error: "Mayur could not reply just now." };
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = payload.choices?.[0]?.message?.content?.trim();
      if (!reply) return { ok: false as const, error: "Mayur could not reply just now." };
      return { ok: true as const, reply };
    } catch (error) {
      console.error("[askMayurTutor] failed", error);
      return { ok: false as const, error: "Network problem while reaching Mayur." };
    }
  });
