import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Mic,
  Volume2,
  XCircle,
  PartyPopper,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  asOptions,
  asPairs,
  getRecognition,
  isAnswerCorrect,
  speak,
  speechSimilarity,
  type EnglishExercise,
} from "@/lib/english";

export const Route = createFileRoute("/_authenticated/english/lesson/$lessonId")({
  head: () => ({
    meta: [
      { title: "English Lesson — Mayur Education" },
      {
        name: "description",
        content:
          "Practise English with quick games: choose the answer, match pairs, fill the blank, listen and speak.",
      },
      { property: "og:title", content: "English Lesson — Mayur Education" },
      { property: "og:description", content: "Interactive English practice with instant feedback." },
    ],
  }),
  component: LessonPlayer,
});

function LessonPlayer() {
  const { lessonId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  const lesson = useQuery({
    queryKey: ["english-lesson", lessonId],
    queryFn: async () => {
      const [l, ex] = await Promise.all([
        supabase
          .from("english_lessons")
          .select("id, title, description, xp_reward, level_id")
          .eq("id", lessonId)
          .maybeSingle(),
        supabase
          .from("english_exercises")
          .select(
            "id, lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position",
          )
          .eq("lesson_id", lessonId)
          .order("position"),
      ]);
      if (l.error || ex.error) throw l.error ?? ex.error;
      return { lesson: l.data, exercises: (ex.data ?? []) as EnglishExercise[] };
    },
  });

  const exercises = lesson.data?.exercises ?? [];
  const total = exercises.length;
  const current = exercises[index];

  async function finish(finalCorrect: number) {
    setFinished(true);
    if (!user) return;
    const xpReward = lesson.data?.lesson?.xp_reward ?? 10;
    const earned = total > 0 ? Math.max(1, Math.round((finalCorrect / total) * xpReward)) : 0;
    setSaving(true);
    const { error } = await supabase.from("english_progress").upsert(
      {
        user_id: user.id,
        lesson_id: lessonId,
        correct_count: finalCorrect,
        total_count: total,
        xp_earned: earned,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    );
    setSaving(false);
    if (error) {
      toast.error("Could not save your progress. Please try again.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["english-progress"] });
    queryClient.invalidateQueries({ queryKey: ["english-stats"] });
    queryClient.invalidateQueries({ queryKey: ["english-leaderboard"] });
    toast.success(`Lesson complete! +${earned} XP`);
  }

  function next(wasCorrect: boolean) {
    const nextCorrect = correctCount + (wasCorrect ? 1 : 0);
    setCorrectCount(nextCorrect);
    if (index + 1 >= total) {
      void finish(nextCorrect);
    } else {
      setIndex(index + 1);
    }
  }

  if (lesson.isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        <p className="mt-2">Loading lesson…</p>
      </main>
    );
  }

  if (!lesson.data?.lesson || total === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="surface-card p-6">
          <h1 className="text-lg font-bold">Lesson not ready</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This lesson has no exercises yet. Please pick another one.
          </p>
          <Button asChild className="mt-4">
            <Link to="/english">Back to Learn English</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (finished) {
    const pct = total ? Math.round((correctCount / total) * 100) : 0;
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="surface-card p-6 text-center">
          <PartyPopper className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 text-2xl font-bold">Well done!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You answered {correctCount} of {total} correctly ({pct}%).
          </p>
          {saving && <p className="mt-2 text-xs text-muted-foreground">Saving your progress…</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIndex(0);
                setCorrectCount(0);
                setFinished(false);
              }}
            >
              Practise again
            </Button>
            <Button onClick={() => navigate({ to: "/english" })}>Back to path</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back">
          <Link to="/english">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{lesson.data.lesson.title}</p>
          <Progress value={((index) / total) * 100} className="mt-1.5" />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {index + 1}/{total}
        </span>
      </div>

      {current && <ExerciseCard key={current.id} exercise={current} onDone={next} />}
    </main>
  );
}

function ExerciseCard({
  exercise,
  onDone,
}: {
  exercise: EnglishExercise;
  onDone: (correct: boolean) => void;
}) {
  const [checked, setChecked] = useState<null | boolean>(null);
  const [choice, setChoice] = useState("");
  const [typed, setTyped] = useState("");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");

  const options = useMemo(() => asOptions(exercise.options), [exercise.options]);
  const pairs = useMemo(() => asPairs(exercise.pairs), [exercise.pairs]);

  // Matching state
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [activeLeft, setActiveLeft] = useState<string | null>(null);
  const shuffledRight = useMemo(
    () => [...pairs.map((p) => p.right)].sort((a, b) => a.localeCompare(b)),
    [pairs],
  );

  function evaluate() {
    if (exercise.kind === "match") {
      const ok = pairs.length > 0 && pairs.every((p) => matched[p.left] === p.right);
      setChecked(ok);
      return;
    }
    if (exercise.kind === "speak") {
      const target = exercise.correct_answer ?? exercise.audio_text ?? exercise.prompt;
      setChecked(speechSimilarity(target, heard) >= 0.6);
      return;
    }
    const answer = exercise.kind === "mcq" || exercise.kind === "audio" ? choice : typed;
    setChecked(isAnswerCorrect(exercise.correct_answer, answer));
  }

  function startListening() {
    const rec = getRecognition("en-IN");
    if (!rec) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }
    setListening(true);
    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript ?? "";
      setHeard(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }

  const canCheck =
    exercise.kind === "match"
      ? Object.keys(matched).length === pairs.length && pairs.length > 0
      : exercise.kind === "speak"
        ? heard.trim().length > 0
        : exercise.kind === "mcq" || exercise.kind === "audio"
          ? !!choice
          : typed.trim().length > 0;

  return (
    <div className="surface-card mt-5 p-5">
      <p className="text-lg font-semibold">{exercise.prompt}</p>
      {exercise.helper_text && (
        <p className="mt-1 text-sm text-muted-foreground">{exercise.helper_text}</p>
      )}

      {(exercise.kind === "audio" || exercise.kind === "speak") && (
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => {
            const text = exercise.audio_text ?? exercise.correct_answer ?? exercise.prompt;
            if (!speak(text)) toast.error("Audio is not supported in this browser.");
          }}
        >
          <Volume2 className="h-4 w-4" /> Listen
        </Button>
      )}

      {(exercise.kind === "mcq" || exercise.kind === "audio") && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={checked !== null}
              onClick={() => setChoice(opt)}
              className={`rounded-xl border p-3 text-left text-sm font-medium transition ${
                choice === opt
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {exercise.kind === "fill_blank" && (
        <Input
          className="mt-4"
          placeholder="Type your answer"
          value={typed}
          disabled={checked !== null}
          onChange={(e) => setTyped(e.target.value)}
        />
      )}

      {exercise.kind === "match" && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-2">
            {pairs.map((p) => (
              <button
                key={p.left}
                type="button"
                disabled={checked !== null}
                onClick={() => setActiveLeft(p.left)}
                className={`w-full rounded-xl border p-3 text-left text-sm font-medium ${
                  activeLeft === p.left
                    ? "border-primary bg-primary-soft text-primary"
                    : matched[p.left]
                      ? "border-primary/40"
                      : "border-border"
                }`}
              >
                {p.left}
                {matched[p.left] && (
                  <span className="block text-xs text-muted-foreground">→ {matched[p.left]}</span>
                )}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {shuffledRight.map((right) => (
              <button
                key={right}
                type="button"
                disabled={checked !== null}
                onClick={() => {
                  if (!activeLeft) {
                    toast.info("Pick a word on the left first.");
                    return;
                  }
                  setMatched((m) => ({ ...m, [activeLeft]: right }));
                  setActiveLeft(null);
                }}
                className="w-full rounded-xl border border-border p-3 text-left text-sm font-medium hover:border-primary/50"
              >
                {right}
              </button>
            ))}
          </div>
        </div>
      )}

      {exercise.kind === "speak" && (
        <div className="mt-4 space-y-2">
          <Button type="button" variant="outline" onClick={startListening} disabled={listening}>
            <Mic className="h-4 w-4" /> {listening ? "Listening…" : "Speak now"}
          </Button>
          {heard && (
            <p className="text-sm text-muted-foreground">
              You said: <span className="font-semibold text-foreground">{heard}</span>
            </p>
          )}
        </div>
      )}

      {checked !== null && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm ${
            checked ? "bg-primary-soft text-primary" : "bg-destructive/10 text-destructive"
          }`}
        >
          {checked ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            <strong>{checked ? "Correct!" : "Not quite."}</strong>{" "}
            {exercise.explanation ??
              (exercise.correct_answer ? `Answer: ${exercise.correct_answer}` : "")}
          </span>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        {checked === null ? (
          <Button onClick={evaluate} disabled={!canCheck}>
            Check
          </Button>
        ) : (
          <Button onClick={() => onDone(checked)}>Continue</Button>
        )}
      </div>
    </div>
  );
}
