import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatTurn = { role: "user" | "assistant"; content: string; image?: string | null };

function toGatewayMessage(m: ChatTurn) {
  if (m.role === "user" && m.image) {
    return {
      role: "user" as const,
      content: [
        {
          type: "text",
          text:
            m.content ||
            "Read this photo of a textbook / question paper and create the content it contains.",
        },
        { type: "image_url", image_url: { url: m.image } },
      ],
    };
  }
  return { role: m.role, content: m.content };
}


const SYSTEM_PROMPT = `You are the AI Admin Copilot inside the "Mayur Education" learning app admin panel.
You help the super admin manage content: subjects, chapters, tests, and questions (MCQs).

Rules:
- Only act on what the admin just asked. Never invent extra content or perform actions that were not requested.
- Always use the provided tools to read or change data. Never claim you did something unless a tool returned success.
- Before creating a chapter or test, look up the subject/chapter id with the list tools. Match names loosely (case-insensitive).
- When generating MCQs, write exam-appropriate Indian school level questions with 4 distinct options, one correct option (A/B/C/D) and a short 1-2 sentence explanation.
- New questions are created as drafts unless the admin explicitly says to publish them.
- Deleting is destructive: only delete when the admin clearly asked for it, and name exactly what you deleted.
- Finish with a short, plain summary of what you did (e.g. "Created Lesson: Linear Equations, Added 5 MCQs to Mathematics"). Keep it under 80 words. No markdown tables.`;

const tools = [
  {
    type: "function",
    function: {
      name: "list_subjects",
      description: "List all subjects with their ids.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_chapters",
      description: "List chapters, optionally filtered by subject id.",
      parameters: {
        type: "object",
        properties: { subject_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tests",
      description: "List tests, optionally filtered by chapter id, with question counts.",
      parameters: {
        type: "object",
        properties: { chapter_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_subject",
      description: "Create a new subject.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" }, description: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_chapter",
      description: "Create a chapter (lesson) inside a subject.",
      parameters: {
        type: "object",
        properties: {
          subject_id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["subject_id", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_test_with_questions",
      description:
        "Create a test inside a chapter and insert MCQ questions with answer keys and explanations.",
      parameters: {
        type: "object",
        properties: {
          chapter_id: { type: "string" },
          title: { type: "string" },
          duration_minutes: { type: "number" },
          publish: { type: "boolean" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_text: { type: "string" },
                option_a: { type: "string" },
                option_b: { type: "string" },
                option_c: { type: "string" },
                option_d: { type: "string" },
                correct_option: { type: "string" },
                explanation: { type: "string" },
              },
              required: [
                "question_text",
                "option_a",
                "option_b",
                "option_c",
                "option_d",
                "correct_option",
              ],
            },
          },
        },
        required: ["chapter_id", "title", "questions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publish_test_questions",
      description: "Publish all draft questions of a test so students can see them.",
      parameters: {
        type: "object",
        properties: { test_id: { type: "string" } },
        required: ["test_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_test",
      description: "Rename a test or change its duration.",
      parameters: {
        type: "object",
        properties: {
          test_id: { type: "string" },
          title: { type: "string" },
          duration_minutes: { type: "number" },
        },
        required: ["test_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_chapter",
      description: "Rename a chapter or change its description.",
      parameters: {
        type: "object",
        properties: {
          chapter_id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["chapter_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_test",
      description: "Delete a test and its questions. Destructive.",
      parameters: {
        type: "object",
        properties: { test_id: { type: "string" } },
        required: ["test_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_chapter",
      description: "Delete a chapter and everything inside it. Destructive.",
      parameters: {
        type: "object",
        properties: { chapter_id: { type: "string" } },
        required: ["chapter_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_passage_with_questions",
      description:
        "Create a reading-comprehension passage inside a test, with descriptive sub-questions and model answers for grading.",
      parameters: {
        type: "object",
        properties: {
          test_id: { type: "string" },
          title: { type: "string" },
          passage_text: { type: "string" },
          publish: { type: "boolean" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_text: { type: "string" },
                model_answer: { type: "string" },
                marks: { type: "number" },
                hint: { type: "string" },
              },
              required: ["question_text", "model_answer"],
            },
          },
        },
        required: ["test_id", "title", "passage_text", "questions"],
      },
    },
  },
] as const;


type Supa = { from: (t: string) => any };

async function runTool(
  supabase: Supa,
  name: string,
  args: any,
  actions: string[],
): Promise<unknown> {
  const fail = (msg: string) => ({ ok: false, error: msg });

  switch (name) {
    case "list_subjects": {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, position")
        .order("position");
      return error ? fail(error.message) : { subjects: data };
    }
    case "list_chapters": {
      let q = supabase.from("chapters").select("id, name, subject_id, position").order("position");
      if (args.subject_id) q = q.eq("subject_id", args.subject_id);
      const { data, error } = await q;
      return error ? fail(error.message) : { chapters: data };
    }
    case "list_tests": {
      let q = supabase
        .from("tests")
        .select("id, title, chapter_id, duration_minutes, position, questions(id, status)")
        .order("position");
      if (args.chapter_id) q = q.eq("chapter_id", args.chapter_id);
      const { data, error } = await q;
      if (error) return fail(error.message);
      return {
        tests: (data ?? []).map((t: any) => ({
          id: t.id,
          title: t.title,
          chapter_id: t.chapter_id,
          duration_minutes: t.duration_minutes,
          questions: t.questions?.length ?? 0,
          drafts: (t.questions ?? []).filter((q: any) => q.status === "draft").length,
        })),
      };
    }
    case "create_subject": {
      const { count } = await supabase
        .from("subjects")
        .select("id", { count: "exact", head: true });
      const { data, error } = await supabase
        .from("subjects")
        .insert({
          name: String(args.name).slice(0, 120),
          description: args.description ? String(args.description).slice(0, 400) : null,
          position: (count ?? 0) + 1,
        })
        .select("id, name")
        .single();
      if (error) return fail(error.message);
      actions.push(`Created subject: ${data.name}`);
      return { ok: true, subject: data };
    }
    case "create_chapter": {
      const { count } = await supabase
        .from("chapters")
        .select("id", { count: "exact", head: true })
        .eq("subject_id", args.subject_id);
      const { data, error } = await supabase
        .from("chapters")
        .insert({
          subject_id: args.subject_id,
          name: String(args.name).slice(0, 160),
          description: args.description ? String(args.description).slice(0, 600) : null,
          position: (count ?? 0) + 1,
        })
        .select("id, name")
        .single();
      if (error) return fail(error.message);
      actions.push(`Created lesson: ${data.name}`);
      return { ok: true, chapter: data };
    }
    case "create_test_with_questions": {
      const questions = Array.isArray(args.questions) ? args.questions : [];
      const clean = questions.filter(
        (q: any) =>
          q?.question_text &&
          q.option_a &&
          q.option_b &&
          q.option_c &&
          q.option_d &&
          ["A", "B", "C", "D"].includes(String(q.correct_option).trim().toUpperCase()),
      );
      if (clean.length === 0) return fail("No valid questions were provided.");

      const { count } = await supabase
        .from("tests")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", args.chapter_id);
      const { data: test, error } = await supabase
        .from("tests")
        .insert({
          chapter_id: args.chapter_id,
          title: String(args.title).slice(0, 160),
          duration_minutes: Math.min(Math.max(Number(args.duration_minutes) || 15, 1), 180),
          position: (count ?? 0) + 1,
        })
        .select("id, title")
        .single();
      if (error || !test) return fail(error?.message ?? "Could not create the test.");

      const publish = args.publish === true;
      const now = new Date().toISOString();
      const { error: qError } = await supabase.from("questions").insert(
        clean.map((q: any, i: number) => ({
          test_id: test.id,
          question_text: String(q.question_text),
          option_a: String(q.option_a),
          option_b: String(q.option_b),
          option_c: String(q.option_c),
          option_d: String(q.option_d),
          correct_option: String(q.correct_option).trim().toUpperCase(),
          explanation: q.explanation ? String(q.explanation) : null,
          position: i + 1,
          question_type: "mcq",
          status: publish ? "published" : "draft",
          published_at: publish ? now : null,
        })),
      );
      if (qError) return fail(qError.message);
      actions.push(
        `Created test: ${test.title} with ${clean.length} MCQs (${publish ? "published" : "draft"})`,
      );
      return { ok: true, test_id: test.id, questions: clean.length, published: publish };
    }
    case "publish_test_questions": {
      const { data, error } = await supabase
        .from("questions")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("test_id", args.test_id)
        .eq("status", "draft")
        .select("id");
      if (error) return fail(error.message);
      actions.push(`Published ${data?.length ?? 0} questions`);
      return { ok: true, published: data?.length ?? 0 };
    }
    case "update_test": {
      const patch: any = {};
      if (args.title) patch.title = String(args.title).slice(0, 160);
      if (args.duration_minutes)
        patch.duration_minutes = Math.min(Math.max(Number(args.duration_minutes), 1), 180);
      if (Object.keys(patch).length === 0) return fail("Nothing to update.");
      const { data, error } = await supabase
        .from("tests")
        .update(patch)
        .eq("id", args.test_id)
        .select("id, title")
        .single();
      if (error) return fail(error.message);
      actions.push(`Updated test: ${data.title}`);
      return { ok: true, test: data };
    }
    case "update_chapter": {
      const patch: any = {};
      if (args.name) patch.name = String(args.name).slice(0, 160);
      if (args.description !== undefined) patch.description = String(args.description).slice(0, 600);
      if (Object.keys(patch).length === 0) return fail("Nothing to update.");
      const { data, error } = await supabase
        .from("chapters")
        .update(patch)
        .eq("id", args.chapter_id)
        .select("id, name")
        .single();
      if (error) return fail(error.message);
      actions.push(`Updated lesson: ${data.name}`);
      return { ok: true, chapter: data };
    }
    case "delete_test": {
      const { data: existing } = await supabase
        .from("tests")
        .select("title")
        .eq("id", args.test_id)
        .maybeSingle();
      const { error } = await supabase.from("tests").delete().eq("id", args.test_id);
      if (error) return fail(error.message);
      actions.push(`Deleted test: ${existing?.title ?? args.test_id}`);
      return { ok: true };
    }
    case "create_passage_with_questions": {
      const subs = (Array.isArray(args.questions) ? args.questions : []).filter(
        (q: any) => q?.question_text && q?.model_answer,
      );
      if (subs.length === 0) return fail("No valid sub-questions were provided.");
      const publish = args.publish === true;
      const now = new Date().toISOString();
      const { count } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("test_id", args.test_id);
      const base = count ?? 0;
      const blank = {
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        correct_option: "",
      };
      const { data: parent, error } = await supabase
        .from("questions")
        .insert({
          test_id: args.test_id,
          question_text: String(args.title).slice(0, 300),
          passage_text: String(args.passage_text).slice(0, 12000),
          question_type: "passage",
          marks: 1,
          status: publish ? "published" : "draft",
          published_at: publish ? now : null,
          position: base + 1,
          ...blank,
        })
        .select("id")
        .single();
      if (error || !parent) return fail(error?.message ?? "Could not save the passage.");

      const { error: subError } = await supabase.from("questions").insert(
        subs.map((s: any, i: number) => ({
          test_id: args.test_id,
          passage_id: parent.id,
          question_text: String(s.question_text),
          question_type: "subjective",
          model_answer: String(s.model_answer),
          hint: s.hint ? String(s.hint) : null,
          marks: Math.min(Math.max(Number(s.marks) || 2, 1), 20),
          status: publish ? "published" : "draft",
          published_at: publish ? now : null,
          position: base + 2 + i,
          ...blank,
        })),
      );
      if (subError) return fail(subError.message);
      actions.push(
        `Created passage: ${String(args.title).slice(0, 60)} with ${subs.length} questions (${publish ? "published" : "draft"})`,
      );
      return { ok: true, passage_id: parent.id, questions: subs.length };
    }

    case "delete_chapter": {
      const { data: existing } = await supabase
        .from("chapters")
        .select("name")
        .eq("id", args.chapter_id)
        .maybeSingle();
      const { error } = await supabase.from("chapters").delete().eq("id", args.chapter_id);
      if (error) return fail(error.message);
      actions.push(`Deleted lesson: ${existing?.name ?? args.chapter_id}`);
      return { ok: true };
    }
    default:
      return fail(`Unknown tool: ${name}`);
  }
}

export const runAdminCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { messages: ChatTurn[] }) => {
    if (!Array.isArray(data?.messages) || data.messages.length === 0) {
      throw new Error("Send a command first");
    }
    return {
      messages: data.messages.slice(-16).map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(m.content ?? "").slice(0, 4000),
        image:
          typeof m.image === "string" && m.image.startsWith("data:image/")
            ? m.image.slice(0, 12_000_000)
            : null,
      })),

    };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return { ok: false as const, error: "Only the super admin can use the AI Admin Copilot." };
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "AI is not configured yet." };

    const actions: string[] = [];
    const convo: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...data.messages.map(toGatewayMessage),
    ];

    for (let step = 0; step < 8; step += 1) {
      let response: Response;
      try {
        response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.7-flash",
            messages: convo,
            tools,
          }),
        });
      } catch (error) {
        console.error("[runAdminCopilot] network", error);
        return { ok: false as const, error: "Network problem while reaching the AI." };
      }

      if (!response.ok) {
        if (response.status === 429) {
          return { ok: false as const, error: "Too many requests. Try again in a moment.", actions };
        }
        if (response.status === 402) {
          return { ok: false as const, error: "AI credits are finished. Please top up.", actions };
        }
        console.error("[runAdminCopilot] gateway", response.status, await response.text());
        return { ok: false as const, error: "The AI could not process that command.", actions };
      }

      const payload = (await response.json()) as {
        choices?: {
          message?: {
            content?: string;
            tool_calls?: { id: string; function: { name: string; arguments: string } }[];
          };
        }[];
      };
      const message = payload.choices?.[0]?.message;
      const toolCalls = message?.tool_calls ?? [];

      if (toolCalls.length === 0) {
        const reply = message?.content?.trim();
        return {
          ok: true as const,
          reply: reply || (actions.length ? actions.join("\n") : "Done."),
          actions,
        };
      }

      convo.push({
        role: "assistant",
        content: message?.content ?? "",
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        let args: any = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }
        let result: unknown;
        try {
          result = await runTool(context.supabase as unknown as Supa, call.function.name, args, actions);
        } catch (error) {
          console.error("[runAdminCopilot] tool failed", call.function.name, error);
          result = { ok: false, error: "That action failed." };
        }
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 6000),
        });
      }
    }

    return {
      ok: true as const,
      reply: actions.length
        ? `Stopped after several steps. Done so far:\n${actions.join("\n")}`
        : "I could not finish that command. Try breaking it into smaller steps.",
      actions,
    };
  });
