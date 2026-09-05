import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Flame,
  Sparkles,
  Star,
  Trophy,
  CheckCircle2,
  Lock,
  MessageCircleHeart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LEVEL_ACCENT } from "@/lib/english";

export const Route = createFileRoute("/_authenticated/english")({
  head: () => ({
    meta: [
      { title: "Learn English — Mayur Education" },
      {
        name: "description",
        content:
          "Learn English step by step: alphabets, sentences, daily conversation and professional English, with XP, streaks and a leaderboard.",
      },
      { property: "og:title", content: "Learn English — Mayur Education" },
      {
        property: "og:description",
        content: "Four levels from alphabets to interview English, with games, XP and streaks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EnglishPath,
});

function EnglishPath() {
  const { user } = useAuth();

  const course = useQuery({
    queryKey: ["english-course"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [levels, lessons] = await Promise.all([
        supabase
          .from("english_levels")
          .select("id, level_number, title, subtitle, description")
          .order("level_number"),
        supabase
          .from("english_lessons")
          .select("id, level_id, title, description, position, xp_reward")
          .order("position"),
      ]);
      if (levels.error || lessons.error) throw levels.error ?? lessons.error;
      return { levels: levels.data ?? [], lessons: lessons.data ?? [] };
    },
  });

  const progress = useQuery({
    queryKey: ["english-progress", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("english_progress")
        .select("lesson_id, correct_count, total_count, xp_earned");
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useQuery({
    queryKey: ["english-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("english_stats")
        .select("xp, current_streak, longest_streak, lessons_completed")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const leaderboard = useQuery({
    queryKey: ["english-leaderboard"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("english_stats")
        .select("user_id, xp, current_streak")
        .order("xp", { ascending: false })
        .limit(10);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];
      const { data: people } = await supabase
        .from("profiles")
        .select("id, username")
        .in(
          "id",
          rows.map((r) => r.user_id),
        );
      const names = new Map((people ?? []).map((p) => [p.id, p.username]));
      return rows.map((r) => ({ ...r, username: names.get(r.user_id) ?? "Student" }));
    },
  });

  const levels = course.data?.levels ?? [];
  const lessons = course.data?.lessons ?? [];
  const done = new Set((progress.data ?? []).map((p) => p.lesson_id));
  const totalLessons = lessons.length;
  const completed = lessons.filter((l) => done.has(l.id)).length;
  const percent = totalLessons ? Math.round((completed / totalLessons) * 100) : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">Learn English</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            From A-B-C to interview English — one small lesson at a time.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/english/tutor">
            <MessageCircleHeart className="h-4 w-4" /> Talk to Mayur
          </Link>
        </Button>
      </div>

      <div className="surface-card mt-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Your course progress</p>
          <p className="text-sm font-bold">{percent}%</p>
        </div>
        <Progress value={percent} className="mt-2" />
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: Star, label: "XP", value: stats.data?.xp ?? 0 },
            { icon: Flame, label: "Day streak", value: stats.data?.current_streak ?? 0 },
            {
              icon: CheckCircle2,
              label: "Lessons done",
              value: `${completed}/${totalLessons}`,
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-muted/60 p-3">
              <s.icon className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1 text-lg font-extrabold">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {levels.map((level) => {
          const levelLessons = lessons.filter((l) => l.level_id === level.id);
          const levelDone = levelLessons.filter((l) => done.has(l.id)).length;
          const accent = LEVEL_ACCENT[level.level_number] ?? LEVEL_ACCENT[1]!;
          return (
            <section key={level.id}>
              <div className={`rounded-2xl bg-gradient-to-r ${accent} p-4`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Level {level.level_number}
                    </p>
                    <h2 className="truncate text-lg font-bold">{level.title}</h2>
                    {level.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{level.subtitle}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-background/70 px-3 py-1 text-xs font-bold">
                    {levelDone}/{levelLessons.length}
                  </span>
                </div>
              </div>

              <ol className="mt-3 space-y-2">
                {levelLessons.map((lesson, i) => {
                  const isDone = done.has(lesson.id);
                  const prev = levelLessons[i - 1];
                  const locked = !!prev && !done.has(prev.id) && !isDone && i > 0;
                  return (
                    <li key={lesson.id}>
                      <Link
                        to="/english/lesson/$lessonId"
                        params={{ lessonId: lesson.id }}
                        disabled={locked}
                        className={`surface-card flex items-center gap-3 p-4 transition ${
                          locked ? "pointer-events-none opacity-60" : "hover:border-primary/50"
                        }`}
                      >
                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${
                            isDone
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : locked ? (
                            <Lock className="h-4 w-4" />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{lesson.title}</span>
                          {lesson.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {lesson.description}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-bold text-primary">
                          +{lesson.xp_reward} XP
                        </span>
                      </Link>
                    </li>
                  );
                })}
                {levelLessons.length === 0 && (
                  <li className="surface-card p-4 text-sm text-muted-foreground">
                    Lessons for this level are coming soon.
                  </li>
                )}
              </ol>
            </section>
          );
        })}
        {course.isLoading && (
          <p className="text-sm text-muted-foreground">Loading your English course…</p>
        )}
      </div>

      <section className="surface-card mt-8 p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <Trophy className="h-4 w-4 text-primary" /> English leaderboard
        </h2>
        <ol className="mt-3 divide-y divide-border">
          {(leaderboard.data ?? []).map((row, i) => (
            <li key={row.user_id} className="flex items-center gap-3 py-2.5">
              <span className="w-6 shrink-0 text-sm font-bold text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.username}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                <Flame className="mr-1 inline h-3 w-3" />
                {row.current_streak}
              </span>
              <span className="shrink-0 text-sm font-extrabold">{row.xp} XP</span>
            </li>
          ))}
          {(leaderboard.data ?? []).length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">
              <Sparkles className="mr-1 inline h-4 w-4" /> Finish a lesson to enter the leaderboard.
            </li>
          )}
        </ol>
      </section>
    </main>
  );
}
