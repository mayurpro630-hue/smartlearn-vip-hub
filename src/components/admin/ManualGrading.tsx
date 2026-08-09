import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ManualGrading() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "graded">("pending");
  const [marks, setMarks] = useState<Record<string, string>>({});

  const answers = useQuery({
    queryKey: ["admin-grading", filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attempt_answers")
        .select(
          "id, user_id, answer_text, awarded_marks, graded, time_spent_seconds, created_at, questions!inner(question_text, model_answer, marks, question_type), test_attempts!inner(is_practice)",
        )
        .eq("questions.question_type", "subjective")
        .eq("test_attempts.is_practice", false)
        .eq("graded", filter === "graded")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const students = useQuery({
    queryKey: ["admin-student-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameOf = (id: string) =>
    students.data?.find((s) => s.id === id)?.username ?? "Student";

  async function save(id: string, max: number) {
    const raw = marks[id];
    const value = Number(raw);
    if (raw === undefined || raw === "" || Number.isNaN(value) || value < 0 || value > max) {
      toast.error(`Enter marks between 0 and ${max}`);
      return;
    }
    const { error } = await supabase
      .from("attempt_answers")
      .update({ awarded_marks: value, graded: true, is_correct: value >= max / 2 })
      .eq("id", id);
    if (error) {
      toast.error("Could not save marks");
      return;
    }
    toast.success("Marks saved");
    queryClient.invalidateQueries();
  }

  const rows = answers.data ?? [];

  return (
    <div className="space-y-4">
      <Select value={filter} onValueChange={(v) => setFilter(v as "pending" | "graded")}>
        <SelectTrigger className="max-w-[240px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Awaiting grading</SelectItem>
          <SelectItem value="graded">Already graded</SelectItem>
        </SelectContent>
      </Select>

      {rows.map((a) => {
        const max = a.questions?.marks ?? 1;
        return (
          <section key={a.id} className="surface-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{nameOf(a.user_id)}</Badge>
              <Badge variant="outline">Max {max} marks</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString()} · {a.time_spent_seconds}s on this question
              </span>
            </div>

            <p className="mt-3 font-semibold">{a.questions?.question_text}</p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  Student answer
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap">
                  {a.answer_text?.trim() || (
                    <span className="text-muted-foreground">Left blank</span>
                  )}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  Model answer
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap">
                  {a.questions?.model_answer?.trim() || (
                    <span className="text-muted-foreground">No model answer set</span>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min={0}
                max={max}
                className="max-w-[120px]"
                placeholder={`0 – ${max}`}
                value={marks[a.id] ?? (a.awarded_marks?.toString() ?? "")}
                onChange={(e) => setMarks((m) => ({ ...m, [a.id]: e.target.value }))}
              />
              <Button onClick={() => save(a.id, max)}>
                <Save className="h-4 w-4" /> {a.graded ? "Update marks" : "Assign marks"}
              </Button>
              {a.graded && (
                <span className="text-sm text-success">
                  Awarded {a.awarded_marks}/{max}
                </span>
              )}
            </div>
          </section>
        );
      })}

      {!answers.isLoading && rows.length === 0 && (
        <p className="surface-card p-4 text-sm text-muted-foreground">
          {filter === "pending"
            ? "Nothing to grade right now."
            : "No graded answers yet."}
        </p>
      )}
    </div>
  );
}
