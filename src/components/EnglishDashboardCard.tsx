import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Languages, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function EnglishDashboardCard() {
  const { user } = useAuth();

  const totals = useQuery({
    queryKey: ["english-lesson-count"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("english_lessons")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const stats = useQuery({
    queryKey: ["english-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("english_stats")
        .select("xp, current_streak, lessons_completed")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const total = totals.data ?? 0;
  const done = stats.data?.lessons_completed ?? 0;
  const percent = total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0;

  return (
    <div className="surface-card p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Languages className="h-4 w-4 text-primary" /> Learn English
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Alphabets to interview English — games, XP and daily streaks.
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/english">Continue</Link>
        </Button>
      </div>

      <Progress value={percent} className="mt-4 h-2" />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {done}/{total} lessons · {percent}%
        </span>
        <span className="inline-flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {stats.data?.xp ?? 0} XP
        </span>
        <span className="inline-flex items-center gap-1">
          <Flame className="h-3.5 w-3.5 text-gold" />
          {stats.data?.current_streak ?? 0} day streak
        </span>
      </div>
    </div>
  );
}
