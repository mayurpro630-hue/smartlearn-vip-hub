import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LETTERS = ["A", "B", "C", "D"] as const;

export function QuestionReview() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"draft" | "published">("draft");

  const q = useQuery({
    queryKey: ["admin-questions", filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select(
          "id, test_id, question_text, option_a, option_b, option_c, option_d, correct_option, model_answer, question_type, marks, status, explanation, hint, position, tests(title)",
        )
        .eq("status", filter)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = q.data ?? [];
  const refresh = () => queryClient.invalidateQueries();

  async function setCorrect(id: string, letter: string) {
    const { error } = await supabase.from("questions").update({ correct_option: letter }).eq("id", id);
    if (error) {
      toast.error("Could not update the correct option");
      return;
    }
    toast.success(`Correct option set to ${letter}`);
    refresh();
  }

  async function publish(ids: string[]) {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("questions")
      .update({ status: "published", published_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      toast.error("Could not publish");
      return;
    }
    toast.success(ids.length === 1 ? "Question published — now live" : `${ids.length} questions published`);
    refresh();
  }

  async function unpublish(id: string) {
    const { error } = await supabase.from("questions").update({ status: "draft" }).eq("id", id);
    if (error) {
      toast.error("Could not move back to draft");
      return;
    }
    toast.success("Moved back to draft");
    refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete");
      return;
    }
    toast.success("Question deleted");
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v as "draft" | "published")}>
          <SelectTrigger className="max-w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Drafts — awaiting review</SelectItem>
            <SelectItem value="published">Published — live</SelectItem>
          </SelectContent>
        </Select>
        {filter === "draft" && rows.length > 0 && (
          <Button onClick={() => publish(rows.map((r) => r.id))}>
            <CheckCircle2 className="h-4 w-4" /> Publish all ({rows.length})
          </Button>
        )}
      </div>

      {rows.map((r) => (
        <section key={r.id} className="surface-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{r.tests?.title ?? "Unassigned test"}</Badge>
            <Badge variant={r.question_type === "subjective" ? "outline" : "default"}>
              {r.question_type === "subjective" ? "Subjective" : "MCQ"}
            </Badge>
            <Badge variant="outline">{r.marks} marks</Badge>
            {r.status === "draft" ? (
              <Badge className="bg-gold-soft text-gold-foreground">Draft</Badge>
            ) : (
              <Badge className="bg-success text-success-foreground">Live</Badge>
            )}
          </div>

          <p className="mt-3 font-semibold">{r.question_text}</p>

          {r.question_type === "mcq" ? (
            <>
              <ul className="mt-3 space-y-1.5 text-sm">
                {LETTERS.map((l) => {
                  const text = { A: r.option_a, B: r.option_b, C: r.option_c, D: r.option_d }[l];
                  const isCorrect = r.correct_option === l;
                  return (
                    <li
                      key={l}
                      className={`rounded-lg border p-2 ${
                        isCorrect
                          ? "border-success bg-success/10 font-semibold text-success"
                          : "border-border"
                      }`}
                    >
                      {l}. {text || <span className="text-muted-foreground">(empty)</span>}
                      {isCorrect && " ✓"}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Fix correct option:</span>
                {LETTERS.map((l) => (
                  <Button
                    key={l}
                    size="sm"
                    variant={r.correct_option === l ? "default" : "outline"}
                    onClick={() => setCorrect(r.id, l)}
                  >
                    {l}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
              <strong>Model answer: </strong>
              {r.model_answer || <span className="text-muted-foreground">Not provided</span>}
            </div>
          )}

          {r.explanation && (
            <p className="mt-3 text-sm text-muted-foreground">
              <strong className="text-foreground">Explanation: </strong>
              {r.explanation}
            </p>
          )}
          {r.hint && (
            <p className="mt-1 text-sm text-muted-foreground">
              <strong className="text-foreground">💡 Hint: </strong>
              {r.hint}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {r.status === "draft" ? (
              <Button onClick={() => publish([r.id])}>
                <CheckCircle2 className="h-4 w-4" /> Publish
              </Button>
            ) : (
              <Button variant="outline" onClick={() => unpublish(r.id)}>
                Move to draft
              </Button>
            )}
            <Button variant="ghost" onClick={() => remove(r.id)}>
              <Trash2 className="h-4 w-4 text-destructive" /> Delete
            </Button>
          </div>
        </section>
      ))}

      {!q.isLoading && rows.length === 0 && (
        <p className="surface-card p-4 text-sm text-muted-foreground">
          {filter === "draft"
            ? "No drafts waiting — every question you added is live."
            : "No published questions yet."}
        </p>
      )}
    </div>
  );
}
