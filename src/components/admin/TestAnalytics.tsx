import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock, Eye, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export function TestAnalytics() {
  const attempts = useQuery({
    queryKey: ["analytics-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_attempts")
        .select(
          "id, test_id, user_id, correct_count, total_questions, time_spent_seconds, tab_switch_count, tests(title, chapters(name))",
        )
        .eq("is_practice", false)
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const map = new Map<
      string,
      {
        title: string;
        chapter: string;
        attempts: number;
        students: Set<string>;
        score: number;
        max: number;
        time: number;
        switches: number;
      }
    >();
    for (const a of attempts.data ?? []) {
      const key = a.test_id;
      const entry =
        map.get(key) ??
        {
          title: a.tests?.title ?? "Untitled test",
          chapter: a.tests?.chapters?.name ?? "",
          attempts: 0,
          students: new Set<string>(),
          score: 0,
          max: 0,
          time: 0,
          switches: 0,
        };
      entry.attempts += 1;
      entry.students.add(a.user_id);
      entry.score += a.correct_count;
      entry.max += a.total_questions;
      entry.time += a.time_spent_seconds;
      entry.switches += a.tab_switch_count;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.attempts - a.attempts);
  }, [attempts.data]);

  const totals = rows.reduce(
    (acc, r) => ({
      attempts: acc.attempts + r.attempts,
      switches: acc.switches + r.switches,
      time: acc.time + r.time,
    }),
    { attempts: 0, switches: 0, time: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="surface-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" /> Total attempts
          </p>
          <p className="mt-1 text-2xl font-extrabold">{totals.attempts}</p>
        </div>
        <div className="surface-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Proctoring events
          </p>
          <p className="mt-1 text-2xl font-extrabold text-destructive">{totals.switches}</p>
        </div>
        <div className="surface-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Total time studied
          </p>
          <p className="mt-1 text-2xl font-extrabold">{Math.round(totals.time / 60)} min</p>
        </div>
      </div>

      <div className="surface-card divide-y divide-border">
        {rows.map((r) => (
          <div key={r.title + r.chapter} className="p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground">{r.chapter}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {r.attempts} attempts
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {r.students.size} students
              </span>
              <span>
                Avg score {r.max > 0 ? Math.round((r.score / r.max) * 100) : 0}%
              </span>
              <span>Avg time {fmt(r.time / r.attempts)}</span>
              <span className={r.switches > 0 ? "text-destructive" : ""}>
                {r.switches} tab switches
              </span>
            </div>
          </div>
        ))}
        {!attempts.isLoading && rows.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No attempts recorded yet.</p>
        )}
      </div>
    </div>
  );
}

export function AttemptBreakdown({ attemptId }: { attemptId: string }) {
  const q = useQuery({
    queryKey: ["attempt-breakdown", attemptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attempt_answers")
        .select(
          "id, selected_option, answer_text, is_correct, awarded_marks, graded, time_spent_seconds, questions(question_text, question_type, marks, position)",
        )
        .eq("attempt_id", attemptId);
      if (error) throw error;
      return (data ?? []).sort(
        (a, b) => (a.questions?.position ?? 0) - (b.questions?.position ?? 0),
      );
    },
  });

  if (q.isLoading) {
    return <p className="mt-2 text-xs text-muted-foreground">Loading question timings…</p>;
  }

  return (
    <ul className="mt-2 space-y-1.5 text-xs">
      {(q.data ?? []).map((a, i) => (
        <li key={a.id} className="rounded-lg bg-muted p-2">
          <p className="font-medium text-foreground">
            {i + 1}. {a.questions?.question_text}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {a.questions?.question_type === "subjective"
              ? a.graded
                ? `Graded ${a.awarded_marks}/${a.questions?.marks}`
                : "Awaiting manual grading"
              : `Answered ${a.selected_option ?? "—"} · ${a.is_correct ? "correct" : "wrong"}`}
            {" · "}
            <Clock className="inline h-3 w-3" /> {fmt(a.time_spent_seconds)} on this question
          </p>
        </li>
      ))}
      {(q.data ?? []).length === 0 && (
        <li className="text-muted-foreground">No per-question data for this attempt.</li>
      )}
    </ul>
  );
}
