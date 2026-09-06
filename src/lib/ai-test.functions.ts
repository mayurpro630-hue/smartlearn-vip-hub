import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type GeneratedQuestion = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string;
};

const SYSTEM_PROMPT = `You create high quality multiple choice exam questions for Indian school students (Mayur Education app).
Rules:
- Always return valid JSON only, matching the requested schema. No markdown, no extra text.
- Each question has exactly 4 distinct options and one clearly correct answer.
- correct_option must be one of "A", "B", "C", "D".
- Add a short, simple explanation (1-2 sentences) for every question.
- Use simple, exam-appropriate English. Avoid trick questions and repetition.`;

export const generateAiTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      chapterId: string;
      command: string;
      count?: number;
      durationMinutes?: number;
      title?: string;
      publish?: boolean;
    }) => {
      if (!data?.chapterId) throw new Error("Pick a chapter first");
      const command = String(data?.command ?? "").trim();
      if (!command) throw new Error("Write what the test should cover");
      return {
        chapterId: data.chapterId,
        command: command.slice(0, 1500),
        count: Math.min(Math.max(Number(data.count) || 10, 1), 30),
        durationMinutes: Math.min(Math.max(Number(data.durationMinutes) || 15, 1), 180),
        title: String(data.title ?? "").slice(0, 120),
        publish: data.publish !== false,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false as const, error: "Only the super admin can generate tests." };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "AI is not configured yet." };

    let payload: { title?: string; questions?: GeneratedQuestion[] };
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.7-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `${data.command}\n\nGenerate exactly ${data.count} multiple choice questions.\nReturn JSON shaped like: {"title": "short test title", "questions": [{"question_text": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A", "explanation": "..."}]}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return { ok: false as const, error: "Too many requests right now. Try again shortly." };
        }
        if (response.status === 402) {
          return {
            ok: false as const,
            error: "AI credits are finished. Add credits to keep generating tests.",
          };
        }
        return { ok: false as const, error: "The AI could not generate this test." };
      }

      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      payload = JSON.parse(content.replace(/^```json\s*|```$/g, "").trim());
    } catch {
      return { ok: false as const, error: "The AI reply could not be read. Try again." };
    }

    const questions = (payload.questions ?? []).filter(
      (q) =>
        q &&
        q.question_text &&
        q.option_a &&
        q.option_b &&
        q.option_c &&
        q.option_d &&
        ["A", "B", "C", "D"].includes(String(q.correct_option).toUpperCase()),
    );
    if (questions.length === 0) {
      return { ok: false as const, error: "No usable questions came back. Try a clearer command." };
    }

    const { count: existing } = await context.supabase
      .from("tests")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", data.chapterId);

    const { data: test, error: testError } = await context.supabase
      .from("tests")
      .insert({
        chapter_id: data.chapterId,
        title: data.title || payload.title || "AI generated test",
        duration_minutes: data.durationMinutes,
        position: (existing ?? 0) + 1,
      })
      .select("id, title")
      .single();

    if (testError || !test) {
      return { ok: false as const, error: "Could not save the test." };
    }

    const now = new Date().toISOString();
    const { error: qError } = await context.supabase.from("questions").insert(
      questions.map((q, i) => ({
        test_id: test.id,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: String(q.correct_option).toUpperCase(),
        explanation: q.explanation ?? null,
        position: i + 1,
        status: data.publish ? ("published" as const) : ("draft" as const),
        published_at: data.publish ? now : null,
      })),
    );

    if (qError) {
      return { ok: false as const, error: "Questions could not be saved." };
    }

    return {
      ok: true as const,
      testId: test.id,
      title: test.title,
      count: questions.length,
      published: data.publish,
    };
  });
