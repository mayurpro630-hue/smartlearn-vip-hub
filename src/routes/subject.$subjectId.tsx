import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/subject/$subjectId")({
  head: () => ({
    meta: [
      { title: "Subject chapters — Mayur Education" },
      {
        name: "description",
        content: "Browse all chapters inside this subject and open their practice tests.",
      },
      { property: "og:title", content: "Subject chapters — Mayur Education" },
      {
        property: "og:description",
        content: "Chapter-wise MCQ practice tests for every subject.",
      },
    ],
  }),
  component: SubjectPage,
});

function SubjectPage() {
  const { subjectId } = Route.useParams();

  const q = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, description, chapters(id, name, description, position, tests(id))")
        .eq("id", subjectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const chapters = [...(q.data?.chapters ?? [])].sort((a, b) => a.position - b.position);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="text-sm text-primary hover:underline">
        ← All subjects
      </Link>
      {q.isLoading ? (
        <Skeleton className="mt-4 h-10 w-56" />
      ) : (
        <>
          <h1 className="mt-3 text-3xl font-bold">{q.data?.name ?? "Subject"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{q.data?.description}</p>
        </>
      )}

      <div className="mt-6 space-y-3">
        {chapters.map((c) => (
          <Link
            key={c.id}
            to="/chapter/$chapterId"
            params={{ chapterId: c.id }}
            className="surface-card flex items-center gap-3 p-4 transition-colors hover:bg-accent"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <Layers className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{c.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {c.tests?.length ?? 0} tests · {c.description}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
        {!q.isLoading && chapters.length === 0 && (
          <p className="text-sm text-muted-foreground">No chapters yet in this subject.</p>
        )}
      </div>
    </main>
  );
}
