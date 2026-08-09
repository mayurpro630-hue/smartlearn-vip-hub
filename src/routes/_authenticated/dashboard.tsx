import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Flame, Target, BookOpen, ClipboardList, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { VipBadge, VipTierHint } from "@/components/VipBadge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — Mayur Education" },
      {
        name: "description",
        content: "Track your VIP status, cumulative marks, practised subjects and completed tests.",
      },
      { property: "og:title", content: "My Dashboard — Mayur Education" },
      { property: "og:description", content: "Your scores, streak and VIP badge in one place." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useAuth();

  const attempts = useQuery({
    queryKey: ["my-attempts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_attempts")
        .select(
          "id, score, total_questions, correct_count, time_spent_seconds, tab_switch_count, is_practice, created_at, tests(id, title, chapters(id, name, subjects(id, name)))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = attempts.data ?? [];
  const subjectsPractised = new Set(
    rows.map((r) => r.tests?.chapters?.subjects?.name).filter(Boolean),
  );
  const chaptersDone = new Set(rows.map((r) => r.tests?.chapters?.name).filter(Boolean));
  const cheatTotal = rows.reduce((a, r) => a + r.tab_switch_count, 0);

  const stats = [
    { icon: Target, label: "Total marks", value: profile?.total_score ?? 0 },
    { icon: ClipboardList, label: "Tests taken", value: profile?.tests_taken ?? 0 },
    { icon: BookOpen, label: "Subjects practised", value: subjectsPractised.size },
    { icon: Flame, label: "Current streak", value: profile?.streak ?? 0 },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">
            Hi, {profile?.username ?? "student"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Your progress at a glance.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <VipBadge tier={profile?.vip_tier} className="px-3 py-1.5 text-sm" />
        {profile?.is_vip ? (
          <span className="gold-gradient inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold shadow-[var(--shadow-gold)]">
            <Crown className="h-4 w-4" /> VIP Active
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-muted-foreground">
            <Crown className="h-4 w-4" /> VIP Inactive
          </span>
        )}
        </div>
      </div>
      <div className="mt-2">
        <VipTierHint />
      </div>

      {!profile?.is_vip && (
        <div className="surface-card mt-5 p-4 text-sm text-muted-foreground">
          Complete <strong className="text-foreground">2 tests back-to-back</strong> (within 24
          hours) to activate your VIP badge and unlock the 💡 Hint button.
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="surface-card p-4">
            <s.icon className="h-4 w-4 text-primary" />
            <p className="mt-2 text-2xl font-extrabold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="surface-card p-4">
          <p className="text-sm font-semibold">Chapters completed</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {chaptersDone.size > 0 ? [...chaptersDone].join(", ") : "None yet"}
          </p>
        </div>
        <div className="surface-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <ShieldAlert className="h-4 w-4 text-destructive" /> Focus warnings recorded
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {cheatTotal} tab switch / minimise events across your tests.
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Recent attempts</h2>
        <Button asChild variant="outline" size="sm">
          <Link to="/revision">Revision list</Link>
        </Button>
      </div>

      <div className="surface-card mt-3 divide-y divide-border">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {r.tests?.chapters?.subjects?.name} · {r.tests?.chapters?.name} · {r.tests?.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()} · {Math.round(r.time_spent_seconds / 60)}m{" "}
                {r.time_spent_seconds % 60}s · {r.tab_switch_count} switches ·{" "}
                {r.is_practice ? "Practice" : "Official"}
              </p>
            </div>
            <p className="shrink-0 text-right text-lg font-extrabold">
              {r.correct_count}
              <span className="text-sm font-medium text-muted-foreground">
                /{r.total_questions}
              </span>
            </p>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="p-5 text-sm text-muted-foreground">
            No attempts yet.{" "}
            <Link to="/" className="text-primary hover:underline">
              Pick a subject
            </Link>{" "}
            to begin.
          </p>
        )}
      </div>
    </main>
  );
}
