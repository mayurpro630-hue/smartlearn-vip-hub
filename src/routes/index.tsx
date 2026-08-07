import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Crown, Flame, Timer, ShieldCheck, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mayur Education — Practice MCQ Tests & Win VIP Badges" },
      {
        name: "description",
        content:
          "Subject-wise chapters and timed MCQ tests with instant results, explanations, revision lists and a VIP leaderboard.",
      },
      { property: "og:title", content: "Mayur Education — Practice MCQ Tests & Win VIP Badges" },
      {
        property: "og:description",
        content: "Timed MCQ practice, instant results and a live VIP leaderboard for students.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();

  const subjects = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, description, position, chapters(id)")
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const board = useQuery({
    queryKey: ["vip-board"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, total_score, tests_taken, is_vip, streak")
        .order("total_score", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <section className="hero-gradient mt-4 rounded-3xl px-5 py-10 sm:px-10 sm:py-14">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-80">
          Mayur Education
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl leading-tight font-extrabold sm:text-5xl">
          Practice smarter. Score higher. Wear the crown.
        </h1>
        <p className="mt-4 max-w-xl text-sm opacity-90 sm:text-base">
          Timed chapter-wise MCQ tests with instant results, detailed explanations, revision lists
          and a live VIP leaderboard.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link to={user ? "/dashboard" : "/auth"}>
              {user ? "Go to my dashboard" : "Start free — sign up"}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-transparent">
            <a href="#subjects">Browse subjects</a>
          </Button>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Timer, label: "Timed tests" },
            { icon: ShieldCheck, label: "Proctored practice" },
            { icon: Crown, label: "VIP hints" },
            { icon: Trophy, label: "Leaderboard" },
          ].map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold sm:text-sm"
            >
              <f.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{f.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="subjects" className="mt-12 scroll-mt-24">
        <h2 className="text-2xl font-bold">Subjects</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a subject, open a chapter, then take Test 1, 2, 3…
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.isLoading &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          {subjects.data?.map((s) => (
            <Link
              key={s.id}
              to="/subject/$subjectId"
              params={{ subjectId: s.id }}
              className="surface-card group p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <BookOpen className="h-4 w-4" />
                </span>
                <h3 className="min-w-0 truncate text-lg font-bold">{s.name}</h3>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
              <p className="mt-4 text-xs font-semibold text-primary">
                {s.chapters?.length ?? 0} chapters →
              </p>
            </Link>
          ))}
          {subjects.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No subjects published yet.</p>
          )}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-gold" />
          <h2 className="text-2xl font-bold">VIP Board</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete 2 tests back-to-back to activate your VIP badge and unlock hints.
        </p>
        <div className="surface-card mt-5 divide-y divide-border">
          {board.isLoading && <div className="p-5"><Skeleton className="h-6 w-40" /></div>}
          {board.data?.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <span className="w-6 shrink-0 text-sm font-bold text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{p.username}</span>
              {p.is_vip && (
                <span className="gold-gradient inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold">
                  <Crown className="h-3 w-3" /> VIP
                </span>
              )}
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Flame className="h-3.5 w-3.5" />
                {p.streak}
              </span>
              <span className="w-16 shrink-0 text-right text-sm font-bold">{p.total_score}</span>
            </div>
          ))}
          {board.data?.length === 0 && (
            <p className="p-5 text-sm text-muted-foreground">
              No students on the board yet — be the first!
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
