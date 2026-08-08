import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bookmark,
  Check,
  Clock,
  Crown,
  Flag,
  Lightbulb,
  Share2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/test/$testId")({
  head: () => ({
    meta: [
      { title: "Take test — Mayur Education" },
      {
        name: "description",
        content: "Timed MCQ test with instant results, explanations and VIP hints.",
      },
      { property: "og:title", content: "Take test — Mayur Education" },
      { property: "og:description", content: "Timed MCQ test with instant scoring." },
    ],
  }),
  component: TestPage,
});

const LETTERS = ["A", "B", "C", "D"] as const;

type Question = {
  id: string;
  question_text: string;
  question_type: string;
  marks: number;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string | null;
  hint: string | null;
  position: number;
};

function optionText(q: Question, letter: string) {
  return { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d }[letter] ?? "";
}

function TestPage() {
  const { testId } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [questionTime, setQuestionTime] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [switches, setSwitches] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number; pending: number } | null>(
    null,
  );
  const submittedRef = useRef(false);

  const q = useQuery({
    queryKey: ["test", testId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tests")
        .select(
          "id, title, duration_minutes, chapter_id, chapters(id, name, subjects(id, name)), questions(id, question_text, question_type, marks, status, option_a, option_b, option_c, option_d, correct_option, explanation, hint, position)",
        )
        .eq("id", testId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const questions = useMemo(
    () =>
      [...((q.data?.questions ?? []) as (Question & { status: string })[])]
        .filter((qq) => qq.status === "published")
        .sort((a, b) => a.position - b.position),
    [q.data],
  );
  const duration = (q.data?.duration_minutes ?? 10) * 60;

  const remaining = Math.max(0, duration - elapsed);

  // Timer
  useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [submitted]);

  // Per-question time tracking
  const currentId = questions[current]?.id;
  useEffect(() => {
    if (submitted || !currentId) return;
    const id = setInterval(
      () => setQuestionTime((t) => ({ ...t, [currentId]: (t[currentId] ?? 0) + 1 })),
      1000,
    );
    return () => clearInterval(id);
  }, [submitted, currentId]);


  // Proctoring: tab switch / minimise / back button
  useEffect(() => {
    if (submitted) return;
    const bump = () => setSwitches((s) => s + 1);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") bump();
    };
    const onPop = () => {
      bump();
      window.history.pushState({ test: testId }, "");
      toast.warning("Back navigation is recorded during a test");
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.history.pushState({ test: testId }, "");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", bump);
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", bump);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [submitted, testId]);

  async function submit(auto = false) {
    if (submittedRef.current || !user || questions.length === 0) return;
    submittedRef.current = true;
    setSaving(true);

    const graded = questions.map((qq) => {
      const subjective = qq.question_type === "subjective";
      return {
        question_id: qq.id,
        selected_option: subjective ? null : (answers[qq.id] ?? null),
        answer_text: subjective ? (textAnswers[qq.id]?.trim() || null) : null,
        is_correct: !subjective && answers[qq.id] === qq.correct_option,
        graded: !subjective,
        awarded_marks: !subjective && answers[qq.id] === qq.correct_option ? qq.marks : 0,
        time_spent_seconds: questionTime[qq.id] ?? 0,
      };
    });
    const mcqs = questions.filter((qq) => qq.question_type !== "subjective");
    const pending = questions.length - mcqs.length;
    const correct = graded.filter((g) => g.is_correct).length;

    const { data: attempt, error } = await supabase
      .from("test_attempts")
      .insert({
        user_id: user.id,
        test_id: testId,
        score: correct,
        total_questions: questions.length,
        correct_count: correct,
        time_spent_seconds: elapsed,
        tab_switch_count: switches,
      })
      .select("id")
      .single();

    if (error || !attempt) {
      submittedRef.current = false;
      setSaving(false);
      toast.error("Could not save your attempt. Please try again.");
      return;
    }

    await supabase
      .from("attempt_answers")
      .insert(graded.map((g) => ({ ...g, attempt_id: attempt.id, user_id: user.id })));

    const wrong = graded.filter((g) => g.graded && !g.is_correct);
    if (wrong.length > 0) {
      await supabase
        .from("bookmarks")
        .upsert(
          wrong.map((w) => ({ user_id: user.id, question_id: w.question_id })),
          { onConflict: "user_id,question_id" },
        );
    }

    setResult({ correct, total: mcqs.length, pending });
    setSubmitted(true);
    setSaving(false);
    queryClient.invalidateQueries();
    toast.success(auto ? "Time up — test submitted" : "Test submitted");
  }


  useEffect(() => {
    if (!submitted && remaining === 0 && questions.length > 0 && elapsed > 0) {
      void submit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, questions.length]);

  if (q.isLoading) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading test…</main>;
  }
  if (!q.data || questions.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">This test has no questions yet.</p>
        <Button asChild className="mt-4">
          <Link to="/">Back to subjects</Link>
        </Button>
      </main>
    );
  }

  if (submitted && result) {
    const percent = Math.round((result.correct / result.total) * 100);
    const shareText = `I scored ${result.correct}/${result.total} (${percent}%) in "${q.data.chapters?.name} — ${q.data.title}" on Mayur Education! 🎓 Can you beat me? ${typeof window !== "undefined" ? window.location.origin : ""}`;

    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="hero-gradient rounded-3xl p-6 text-center sm:p-10">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-80">Your result</p>
          <p className="mt-3 text-5xl font-extrabold">
            {result.correct}/{result.total}
          </p>
          <p className="mt-2 text-sm opacity-90">
            {percent}% · {Math.floor(elapsed / 60)}m {elapsed % 60}s · {switches} focus warnings
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild variant="secondary">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Share2 className="h-4 w-4" /> Share on WhatsApp
              </a>
            </Button>
            <Button variant="outline" className="bg-transparent" onClick={() => navigate({ to: "/dashboard" })}>
              My dashboard
            </Button>
          </div>
        </div>

        <h2 className="mt-8 text-xl font-bold">Answer review</h2>
        <div className="mt-3 space-y-3">
          {questions.map((qq, i) => {
            const chosen = answers[qq.id];
            const ok = chosen === qq.correct_option;
            return (
              <div key={qq.id} className="surface-card p-4">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${ok ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}
                  >
                    {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </span>
                  <p className="min-w-0 font-semibold">
                    {i + 1}. {qq.question_text}
                  </p>
                </div>
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Your answer: </span>
                  {chosen ? `${chosen}. ${optionText(qq, chosen)}` : "Not answered"}
                </p>
                {!ok && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Correct answer: </span>
                    <span className="font-semibold text-success">
                      {qq.correct_option}. {optionText(qq, qq.correct_option)}
                    </span>
                  </p>
                )}
                {qq.explanation && (
                  <p className="mt-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    <strong className="text-foreground">Explanation: </strong>
                    {qq.explanation}
                  </p>
                )}
                {!ok && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Bookmark className="h-3.5 w-3.5" /> Saved to your Revision list
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/chapter/$chapterId" params={{ chapterId: q.data.chapter_id }}>
            Back to chapter
          </Link>
        </Button>
      </main>
    );
  }

  const question = questions[current]!;
  const answeredCount = Object.keys(answers).length;
  const lowTime = remaining <= 30;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">
            {q.data.chapters?.subjects?.name} · {q.data.chapters?.name}
          </p>
          <h1 className="truncate text-xl font-bold">{q.data.title}</h1>
        </div>
        <div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${lowTime ? "bg-destructive text-destructive-foreground" : "bg-primary-soft text-primary"}`}
        >
          <Clock className="h-4 w-4" />
          {String(Math.floor(remaining / 60)).padStart(2, "0")}:
          {String(remaining % 60).padStart(2, "0")}
        </div>
      </div>

      <Progress value={(answeredCount / questions.length) * 100} className="mt-4" />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {current + 1} of {questions.length}
        </span>
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" /> {switches} focus warnings
        </span>
      </div>

      <div className="surface-card mt-4 p-5">
        <p className="font-semibold">{question.question_text}</p>

        <div className="mt-4 space-y-2">
          {LETTERS.map((l) => {
            const selected = answers[question.id] === l;
            return (
              <button
                key={l}
                onClick={() => setAnswers((a) => ({ ...a, [question.id]: l }))}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                  selected
                    ? "border-primary bg-primary-soft font-semibold text-primary"
                    : "border-border hover:bg-accent"
                }`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-xs font-bold">
                  {l}
                </span>
                <span className="min-w-0">{optionText(question, l)}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={profile?.is_vip ? "default" : "outline"}
            onClick={() => {
              if (!profile?.is_vip) {
                toast.error("💡 Hints are VIP only — finish 2 tests back-to-back to unlock");
                return;
              }
              setShowHint((h) => ({ ...h, [question.id]: true }));
            }}
          >
            <Lightbulb className="h-4 w-4" /> Hint
            {!profile?.is_vip && <Crown className="h-3.5 w-3.5 text-gold" />}
          </Button>
          <ReportDialog questionId={question.id} userId={user?.id} />
        </div>

        {showHint[question.id] && profile?.is_vip && (
          <p className="mt-3 rounded-lg bg-gold-soft p-3 text-sm text-gold-foreground">
            💡 {question.hint ?? "No hint available for this question."}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
        >
          Previous
        </Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)}>Next</Button>
        ) : (
          <Button disabled={saving} onClick={() => submit(false)}>
            {saving ? "Submitting…" : "Submit test"}
          </Button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            onClick={() => setCurrent(i)}
            className={`h-8 w-8 rounded-lg text-xs font-bold ${
              i === current
                ? "bg-primary text-primary-foreground"
                : answers[qq.id]
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </main>
  );
}

function ReportDialog({
  questionId,
  userId,
}: {
  questionId: string;
  userId: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function send() {
    const text = message.trim();
    if (text.length < 5 || text.length > 500) {
      toast.error("Please describe the issue (5-500 characters)");
      return;
    }
    if (!userId) return;
    const { error } = await supabase
      .from("error_reports")
      .insert({ user_id: userId, question_id: questionId, message: text });
    if (error) {
      toast.error("Could not send report");
      return;
    }
    toast.success("Thanks! Reported to the admin.");
    setMessage("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Flag className="h-4 w-4" /> Report error
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an issue with this question</DialogTitle>
        </DialogHeader>
        <Textarea
          value={message}
          maxLength={500}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Wrong answer marked correct, typo, unclear options…"
        />
        <DialogFooter>
          <Button onClick={send}>Send report</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
