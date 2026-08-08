import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, FileText, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/chapter/$chapterId")({
  head: () => ({
    meta: [
      { title: "Chapter tests — Mayur Education" },
      {
        name: "description",
        content: "Take timed MCQ tests for this chapter and get instant results with explanations.",
      },
      { property: "og:title", content: "Chapter tests — Mayur Education" },
      {
        property: "og:description",
        content: "Timed MCQ tests with instant scoring and detailed answer explanations.",
      },
    ],
  }),
  component: ChapterPage,
});

function ChapterPage() {
  const { chapterId } = Route.useParams();
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["chapter", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, name, description, subject_id, tests(id, title, duration_minutes, position)")
        .eq("id", chapterId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tests = [...(q.data?.tests ?? [])].sort((a, b) => a.position - b.position);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {q.data && (
        <Link
          to="/subject/$subjectId"
          params={{ subjectId: q.data.subject_id }}
          className="text-sm text-primary hover:underline"
        >
          ← Back to chapters
        </Link>
      )}
      {q.isLoading ? (
        <Skeleton className="mt-4 h-10 w-56" />
      ) : (
        <>
          <h1 className="mt-3 text-3xl font-bold">{q.data?.name ?? "Chapter"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{q.data?.description}</p>
        </>
      )}

      {!user && (
        <div className="surface-card mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted-foreground">Login to take tests and save your scores.</p>
          <Button asChild size="sm">
            <Link to="/auth">Login / Sign up</Link>
          </Button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {tests.map((t) => (
          <div key={t.id} className="surface-card flex items-center gap-3 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{t.title}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {t.duration_minutes} min
              </span>
            </span>
            <Button asChild size="sm" className="shrink-0">
              {user ? (
                <Link to="/test/$testId" params={{ testId: t.id }}>
                  <PlayCircle className="h-4 w-4" /> Start
                </Link>
              ) : (
                <Link to="/auth">
                  <PlayCircle className="h-4 w-4" /> Start
                </Link>
              )}
            </Button>

          </div>
        ))}
        {!q.isLoading && tests.length === 0 && (
          <p className="text-sm text-muted-foreground">No tests yet in this chapter.</p>
        )}
      </div>
    </main>
  );
}
