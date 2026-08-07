import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookmarkX, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/revision")({
  head: () => ({
    meta: [
      { title: "Revision & Bookmarks — Mayur Education" },
      {
        name: "description",
        content: "Review every question you answered incorrectly, with the correct answer and explanation.",
      },
      { property: "og:title", content: "Revision & Bookmarks — Mayur Education" },
      { property: "og:description", content: "Your saved wrong answers, ready for revision." },
    ],
  }),
  component: Revision,
});

function Revision() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ["bookmarks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select(
          "id, created_at, questions(id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, tests(title, chapters(name, subjects(name))))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function remove(id: string) {
    const { error } = await supabase.from("bookmarks").delete().eq("id", id);
    if (error) {
      toast.error("Could not remove");
      return;
    }
    toast.success("Removed from revision");
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
  }

  const rows = q.data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Revision list</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every question you got wrong is saved here automatically.
      </p>

      <div className="mt-6 space-y-3">
        {rows.map((b) => {
          const qq = b.questions;
          if (!qq) return null;
          const correct =
            { A: qq.option_a, B: qq.option_b, C: qq.option_c, D: qq.option_d }[
              qq.correct_option
            ] ?? "";
          return (
            <div key={b.id} className="surface-card p-4">
              <p className="text-xs text-muted-foreground">
                {qq.tests?.chapters?.subjects?.name} · {qq.tests?.chapters?.name} ·{" "}
                {qq.tests?.title}
              </p>
              <p className="mt-1 font-semibold">{qq.question_text}</p>
              <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-success">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                {qq.correct_option}. {correct}
              </p>
              {qq.explanation && (
                <p className="mt-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  {qq.explanation}
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => remove(b.id)}
              >
                <BookmarkX className="h-4 w-4" /> Mastered — remove
              </Button>
            </div>
          );
        })}
        {!q.isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing to revise yet.{" "}
            <Link to="/" className="text-primary hover:underline">
              Take a test
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
