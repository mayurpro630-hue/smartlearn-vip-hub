import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpen,
  Bookmark,
  Check,
  Clock,
  Copy,
  Crown,
  Flag,
  Lightbulb,
  Share2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { copyText } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { VoiceTextarea } from "@/components/VoiceTextarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function CopyButton({ text, label = "Copy" }: { text: string | null | undefined; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => void copyText(text ?? "", "Copied to clipboard")}
      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground hover:text-foreground"
    >
      <Copy className="h-3 w-3" /> {label}
    </button>
  );
}

/** Own interval so the clock never re-renders the whole test page. */
function TimerBadge({
  startedAt,
  duration,
  paused,
  onExpire,
}: {
  startedAt: number;
  duration: number;
  paused: boolean;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, duration - Math.round((Date.now() - startedAt) / 1000)),
  );
  const firedRef = useRef(false);

  useEffect(() => {
    if (paused) return;
    const tick = () => {
      const left = Math.max(0, duration - Math.round((Date.now() - startedAt) / 1000));
      setRemaining(left);
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, duration, startedAt]);

  const lowTime = remaining <= 30;
  return (
    <div
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${lowTime ? "bg-destructive text-destructive-foreground" : "bg-primary-soft text-primary"}`}
    >
      <Clock className="h-4 w-4" />
      {String(Math.floor(remaining / 60)).padStart(2, "0")}:
      {String(remaining % 60).padStart(2, "0")}
    </div>
  );
}


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
  passage_text: string | null;
  passage_id: string | null;
};

type Item =
  | { kind: "single"; question: Question }
  | { kind: "passage"; parent: Question; children: Question[] };

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
  const [current, setCurrent] = useState(0);
  const [switches, setSwitches] = useState(0);
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
    pending: number;
    practice: boolean;
    elapsed: number;
  } | null>(
    null,
  );
  const submittedRef = useRef(false);
  const startRef = useRef<number>(Date.now());
  // Per-question seconds are kept in a ref so the whole test page does not
  // re-render every second (that was the main source of lag).
  const timeRef = useRef<Record<string, number>>({});
  const spanRef = useRef<{ ids: string[]; at: number } | null>(null);

  function flushSpan() {
    const span = spanRef.current;
    if (!span) return;
    const secs = Math.max(0, Math.round((Date.now() - span.at) / 1000));
    for (const id of span.ids) timeRef.current[id] = (timeRef.current[id] ?? 0) + secs;
    span.at = Date.now();
  }

  const draftKey = user ? `me:test-draft:${user.id}:${testId}` : null;

  const q = useQuery({
    queryKey: ["test", testId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tests")
        .select(
          "id, title, duration_minutes, chapter_id, chapters(id, name, subjects(id, name)), questions(id, question_text, question_type, marks, status, option_a, option_b, option_c, option_d, correct_option, explanation, hint, position, passage_text, passage_id)",
        )
        .eq("id", testId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const priorAttempts = useQuery({
    queryKey: ["prior-attempts", testId, user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("test_attempts")
        .select("id", { count: "exact", head: true })
        .eq("test_id", testId)
        .eq("user_id", user!.id)
        .eq("is_practice", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const practiceMode = (priorAttempts.data ?? 0) > 0;


  const published = useMemo(
    () =>
      [...((q.data?.questions ?? []) as (Question & { status: string })[])]
        .filter((qq) => qq.status === "published")
        .sort((a, b) => a.position - b.position),
    [q.data],
  );

  // Items are what the student pages through: a standalone question, or a
  // reading passage together with all of its sub-questions.
  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const qq of published) {
      if (qq.passage_id) continue;
      if (qq.question_type === "passage") {
        list.push({
          kind: "passage",
          parent: qq,
          children: published.filter((c) => c.passage_id === qq.id),
        });
      } else {
        list.push({ kind: "single", question: qq });
      }
    }
    return list.filter((it) => it.kind === "single" || it.children.length > 0);
  }, [published]);

  // Everything that is actually answered/graded (passage rows themselves aren't).
  const answerable = useMemo(
    () =>
      items.flatMap((it) => (it.kind === "single" ? [it.question] : it.children)),
    [items],
  );

  const duration = (q.data?.duration_minutes ?? 10) * 60;

  // Per-question time tracking (a passage's time is credited to each sub-question)
  const item = items[current];
  const trackedKey = useMemo(() => {
    if (!item) return "";
    return (item.kind === "single" ? [item.question.id] : item.children.map((c) => c.id)).join(",");
  }, [item]);
  useEffect(() => {
    if (submitted || !trackedKey) return;
    spanRef.current = { ids: trackedKey.split(","), at: Date.now() };
    return () => {
      flushSpan();
      spanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, trackedKey]);

  // Restore an in-progress attempt so a refresh, crash or app reload never
  // wipes the student's typed answers.
  useEffect(() => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        answers?: Record<string, string>;
        textAnswers?: Record<string, string>;
        times?: Record<string, number>;
        startedAt?: number;
      };
      if (saved.answers) setAnswers(saved.answers);
      if (saved.textAnswers) setTextAnswers(saved.textAnswers);
      if (saved.times) timeRef.current = saved.times;
      if (saved.startedAt) startRef.current = saved.startedAt;
    } catch {
      // corrupt draft — ignore
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || submitted || typeof window === "undefined") return;
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({
            answers,
            textAnswers,
            times: timeRef.current,
            startedAt: startRef.current,
          }),
        );
      } catch {
        // storage full / blocked — keep going
      }
    }, 400);
    return () => clearTimeout(id);
  }, [answers, textAnswers, draftKey, submitted]);


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

  function isAnswered(qq: Question) {
    return qq.question_type === "mcq"
      ? Boolean(answers[qq.id])
      : (textAnswers[qq.id]?.trim().length ?? 0) > 0;
  }

  async function submit(auto = false) {
    if (submittedRef.current || !user || answerable.length === 0) return;
    submittedRef.current = true;
    setSaving(true);
    flushSpan();
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startRef.current) / 1000));

    const graded = answerable.map((qq) => {
      const written = qq.question_type !== "mcq";
      return {
        question_id: qq.id,
        selected_option: written ? null : (answers[qq.id] ?? null),
        answer_text: written ? (textAnswers[qq.id]?.trim() || null) : null,
        is_correct: !written && answers[qq.id] === qq.correct_option,
        graded: !written,
        awarded_marks: !written && answers[qq.id] === qq.correct_option ? qq.marks : 0,
        time_spent_seconds: timeRef.current[qq.id] ?? 0,
      };
    });
    const mcqs = answerable.filter((qq) => qq.question_type === "mcq");
    const pending = answerable.length - mcqs.length;
    const correct = graded.filter((g) => g.is_correct).length;

    const { data: attempt, error } = await supabase
      .from("test_attempts")
      .insert({
        user_id: user.id,
        test_id: testId,
        score: correct,
        total_questions: answerable.length,
        correct_count: correct,
        time_spent_seconds: elapsedSeconds,
        tab_switch_count: switches,
      })
      .select("id, is_practice")
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

    setResult({
      correct,
      total: mcqs.length,
      pending,
      practice: attempt.is_practice,
      elapsed: elapsedSeconds,
    });
    setSubmitted(true);
    setSaving(false);
    if (draftKey && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }
    for (const key of ["profile", "role", "attempts", "prior-attempts", "top-vip", "bookmarks"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
    toast.success(
      attempt.is_practice
        ? "Practice attempt saved — your official score is unchanged"
        : auto
          ? "Time up — test submitted"
          : "Test submitted",
    );
  }


  if (q.isLoading) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading test…</main>;
  }
  if (!q.data || answerable.length === 0) {
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
    const percent = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
    const shareText = `I scored ${result.correct}/${result.total} (${percent}%) in "${q.data.chapters?.name} — ${q.data.title}" on Mayur Education! 🎓 Can you beat me? ${typeof window !== "undefined" ? window.location.origin : ""}`;

    let reviewIndex = 0;

    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="hero-gradient rounded-3xl p-6 text-center sm:p-10">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-80">Your result</p>
          <p className="mt-3 text-5xl font-extrabold">
            {result.correct}/{result.total}
          </p>
          <p className="mt-2 text-sm opacity-90">
            {percent}% · {Math.floor(result.elapsed / 60)}m {result.elapsed % 60}s · {switches} focus
            warnings

          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background/20 px-3 py-1 text-xs font-bold">
            {result.practice ? "Practice mode — official score unchanged" : "Official attempt recorded"}
          </p>
          {result.pending > 0 && (
            <p className="mt-2 text-sm opacity-90">
              {result.pending} written answer{result.pending > 1 ? "s" : ""} sent to your teacher for
              manual grading.
            </p>
          )}
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
          {items.map((it) => {
            if (it.kind === "passage") {
              return (
                <div key={it.parent.id} className="surface-card p-4">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5" /> Reading passage
                  </p>
                  <p className="mt-1 font-semibold">{it.parent.question_text}</p>
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-xl bg-muted p-3 text-sm whitespace-pre-wrap">
                    {it.parent.passage_text}
                  </div>
                  <div className="mt-3 space-y-3">
                    {it.children.map((child) => {
                      reviewIndex += 1;
                      return (
                        <ReviewRow
                          key={child.id}
                          index={reviewIndex}
                          question={child}
                          chosen={answers[child.id]}
                          text={textAnswers[child.id]}
                          seconds={timeRef.current[child.id] ?? 0}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            }
            reviewIndex += 1;
            return (
              <div key={it.question.id} className="surface-card p-4">
                <ReviewRow
                  index={reviewIndex}
                  question={it.question}
                  chosen={answers[it.question.id]}
                  text={textAnswers[it.question.id]}
                  seconds={timeRef.current[it.question.id] ?? 0}
                />
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

  const activeItem = items[current]!;
  const answeredCount = answerable.filter(isAnswered).length;
  const firstIndexOfItem =
    answerable.findIndex(
      (a) => a.id === (activeItem.kind === "single" ? activeItem.question.id : activeItem.children[0]?.id),
    ) + 1;

  return (
    <main className="mx-auto max-w-3xl select-text px-4 py-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">
            {q.data.chapters?.subjects?.name} · {q.data.chapters?.name}
          </p>
          <h1 className="truncate text-xl font-bold">{q.data.title}</h1>
        </div>
        <TimerBadge
          startedAt={startRef.current}
          duration={duration}
          paused={submitted}
          onExpire={() => void submit(true)}
        />
      </div>


      {practiceMode && (
        <div className="mt-4 rounded-2xl border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Practice mode.</strong> You already have an official
          attempt for this test — this retake will not change your official score, leaderboard rank or
          VIP badge.
        </div>
      )}

      <Progress value={(answeredCount / answerable.length) * 100} className="mt-4" />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {activeItem.kind === "passage"
            ? `Passage set · questions ${firstIndexOfItem}–${firstIndexOfItem + activeItem.children.length - 1} of ${answerable.length}`
            : `Question ${firstIndexOfItem} of ${answerable.length}`}
        </span>
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" /> {switches} focus warnings
        </span>
      </div>

      {activeItem.kind === "passage" ? (
        <div className="mt-4 space-y-4">
          <section className="surface-card p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" /> Reading comprehension
              </p>
              <CopyButton text={activeItem.parent.passage_text} label="Copy passage" />
            </div>
            <h2 className="mt-2 select-text font-semibold">{activeItem.parent.question_text}</h2>
            <div className="mt-3 max-h-[45vh] select-text overflow-y-auto rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {activeItem.parent.passage_text ?? "Passage text not available."}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Read the passage carefully, then answer the {activeItem.children.length} question
              {activeItem.children.length > 1 ? "s" : ""} below.
            </p>

          </section>

          {activeItem.children.map((child, i) => (
            <section key={child.id} className="surface-card p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                  Q{firstIndexOfItem + i}
                </span>
                <span>
                  {child.marks} mark{child.marks > 1 ? "s" : ""}
                </span>
                <CopyButton text={child.question_text} label="Copy question" />
              </div>
              <p className="mt-2 select-text font-semibold">{child.question_text}</p>


              {child.question_type === "mcq" ? (
                <div className="mt-4 space-y-2">
                  {LETTERS.map((l) => {
                    const selected = answers[child.id] === l;
                    return (
                      <button
                        key={l}
                        onClick={() => setAnswers((a) => ({ ...a, [child.id]: l }))}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                          selected
                            ? "border-primary bg-primary-soft font-semibold text-primary"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-xs font-bold">
                          {l}
                        </span>
                        <span className="min-w-0">{optionText(child, l)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3">
                  <label
                    htmlFor={`answer-${child.id}`}
                    className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
                  >
                    Your answer
                  </label>
                  <div className="mt-2">
                    <VoiceTextarea
                      id={`answer-${child.id}`}
                      rows={6}
                      placeholder="Type or speak your answer based on the passage…"
                      value={textAnswers[child.id] ?? ""}
                      onChange={(v) => setTextAnswers((t) => ({ ...t, [child.id]: v }))}
                    />
                  </div>
                </div>
              )}


              <div className="mt-4 flex flex-wrap items-center gap-2">
                <HintButton
                  isVip={Boolean(profile?.is_vip)}
                  shown={Boolean(showHint[child.id])}
                  onShow={() => setShowHint((h) => ({ ...h, [child.id]: true }))}
                />
                <ReportDialog questionId={child.id} userId={user?.id} />
              </div>
              {showHint[child.id] && profile?.is_vip && (
                <p className="mt-3 rounded-lg bg-gold-soft p-3 text-sm text-gold-foreground">
                  💡 {child.hint ?? "No hint available for this question."}
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <SingleQuestionCard
          question={activeItem.question}
          seconds={timeRef.current[activeItem.question.id] ?? 0}
          selected={answers[activeItem.question.id]}
          onSelect={(l) => setAnswers((a) => ({ ...a, [activeItem.question.id]: l }))}
          text={textAnswers[activeItem.question.id] ?? ""}
          onText={(v) => setTextAnswers((t) => ({ ...t, [activeItem.question.id]: v }))}
          isVip={Boolean(profile?.is_vip)}
          hintShown={Boolean(showHint[activeItem.question.id])}
          onShowHint={() => setShowHint((h) => ({ ...h, [activeItem.question.id]: true }))}
          userId={user?.id}
        />
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
        >
          Previous
        </Button>
        {current < items.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)}>Next</Button>
        ) : (
          <Button disabled={saving} onClick={() => submit(false)}>
            {saving ? "Submitting…" : "Submit test"}
          </Button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {items.map((it, i) => {
          const qs = it.kind === "single" ? [it.question] : it.children;
          const done = qs.every(isAnswered);
          const label =
            it.kind === "single"
              ? String(answerable.findIndex((a) => a.id === it.question.id) + 1)
              : `P${answerable.findIndex((a) => a.id === it.children[0]!.id) + 1}`;
          return (
            <button
              key={it.kind === "single" ? it.question.id : it.parent.id}
              onClick={() => setCurrent(i)}
              className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold ${
                i === current
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </main>
  );
}

function HintButton({
  isVip,
  shown,
  onShow,
}: {
  isVip: boolean;
  shown: boolean;
  onShow: () => void;
}) {
  return (
    <Button
      size="sm"
      variant={isVip ? "default" : "outline"}
      onClick={() => {
        if (!isVip) {
          toast.error("💡 Hints are VIP only — finish 2 tests back-to-back to unlock");
          return;
        }
        if (!shown) onShow();
      }}
    >
      <Lightbulb className="h-4 w-4" /> Hint
      {!isVip && <Crown className="h-3.5 w-3.5 text-gold" />}
    </Button>
  );
}

function SingleQuestionCard({
  question,
  seconds,
  selected,
  onSelect,
  text,
  onText,
  isVip,
  hintShown,
  onShowHint,
  userId,
}: {
  question: Question;
  seconds: number;
  selected: string | undefined;
  onSelect: (letter: string) => void;
  text: string;
  onText: (value: string) => void;
  isVip: boolean;
  hintShown: boolean;
  onShowHint: () => void;
  userId: string | undefined;
}) {
  const isSubjective = question.question_type !== "mcq";
  return (
    <div className="surface-card mt-4 p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
          {isSubjective ? "Long answer" : "Multiple choice"}
        </span>
        <span>
          {question.marks} mark{question.marks > 1 ? "s" : ""}
        </span>
        <span>· {seconds}s so far</span>
        <CopyButton text={question.question_text} label="Copy question" />
      </div>
      <p className="mt-2 select-text font-semibold">{question.question_text}</p>

      {isSubjective ? (
        <div className="mt-4">
          <label
            htmlFor={`answer-${question.id}`}
            className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
          >
            Write your answer here
          </label>
          <div className="mt-2">
            <VoiceTextarea
              id={`answer-${question.id}`}
              rows={9}
              placeholder="Type or speak your full answer here…"
              value={text}
              onChange={onText}
            />
          </div>
        </div>

      ) : (
        <div className="mt-4 space-y-2">
          {LETTERS.map((l) => {
            const isSelected = selected === l;
            return (
              <button
                key={l}
                onClick={() => onSelect(l)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                  isSelected
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
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <HintButton isVip={isVip} shown={hintShown} onShow={onShowHint} />
        <ReportDialog questionId={question.id} userId={userId} />
      </div>

      {hintShown && isVip && (
        <p className="mt-3 rounded-lg bg-gold-soft p-3 text-sm text-gold-foreground">
          💡 {question.hint ?? "No hint available for this question."}
        </p>
      )}
    </div>
  );
}

function ReviewRow({
  index,
  question,
  chosen,
  text,
  seconds,
}: {
  index: number;
  question: Question;
  chosen: string | undefined;
  text: string | undefined;
  seconds: number;
}) {
  const subjective = question.question_type !== "mcq";
  const ok = !subjective && chosen === question.correct_option;
  return (
    <div>
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
            subjective
              ? "bg-muted text-muted-foreground"
              : ok
                ? "bg-success text-success-foreground"
                : "bg-destructive text-destructive-foreground"
          }`}
        >
          {subjective ? (
            <Clock className="h-3.5 w-3.5" />
          ) : ok ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </span>
        <p className="min-w-0 font-semibold">
          {index}. {question.question_text}
        </p>
      </div>
      {subjective ? (
        <>
          <p className="mt-2 text-sm whitespace-pre-wrap">
            <span className="text-muted-foreground">Your answer: </span>
            {text?.trim() || "Not answered"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Awaiting manual grading · worth {question.marks} mark{question.marks > 1 ? "s" : ""}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Your answer: </span>
            {chosen ? `${chosen}. ${optionText(question, chosen)}` : "Not answered"}
          </p>
          {!ok && (
            <p className="text-sm">
              <span className="text-muted-foreground">Correct answer: </span>
              <span className="font-semibold text-success">
                {question.correct_option}. {optionText(question, question.correct_option)}
              </span>
            </p>
          )}
        </>
      )}
      {question.explanation && (
        <p className="mt-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Explanation: </strong>
          {question.explanation}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Time on this question: {seconds}s</p>
      {!subjective && !ok && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Bookmark className="h-3.5 w-3.5" /> Saved to your Revision list
        </p>
      )}
    </div>
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
