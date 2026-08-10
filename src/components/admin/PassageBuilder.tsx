import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SubQuestion = { text: string; marks: string; modelAnswer: string; hint: string };

const emptySub = (): SubQuestion => ({ text: "", marks: "2", modelAnswer: "", hint: "" });

export function PassageBuilder() {
  const queryClient = useQueryClient();
  const [testId, setTestId] = useState("");
  const [title, setTitle] = useState("");
  const [passage, setPassage] = useState("");
  const [subs, setSubs] = useState<SubQuestion[]>([emptySub(), emptySub()]);
  const [busy, setBusy] = useState(false);

  const tests = useQuery({
    queryKey: ["passage-tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tests")
        .select("id, title, questions(id)")
        .order("title");
      if (error) throw error;
      return data ?? [];
    },
  });

  const existing = useQuery({
    queryKey: ["passage-sets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, question_text, status, test_id, tests(title)")
        .eq("question_type", "passage")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setSub = (i: number, patch: Partial<SubQuestion>) =>
    setSubs((s) => s.map((sub, idx) => (idx === i ? { ...sub, ...patch } : sub)));

  async function save() {
    const filled = subs.filter((s) => s.text.trim());
    if (!testId || !title.trim() || passage.trim().length < 20) {
      toast.error("Pick a test, add a title and a passage of at least 20 characters");
      return;
    }
    if (filled.length === 0) {
      toast.error("Add at least one sub-question");
      return;
    }
    if (filled.some((s) => !s.modelAnswer.trim())) {
      toast.error("Every sub-question needs a model answer for grading");
      return;
    }

    setBusy(true);
    const base = tests.data?.find((t) => t.id === testId)?.questions?.length ?? 0;

    const { data: parent, error } = await supabase
      .from("questions")
      .insert({
        test_id: testId,
        question_text: title.trim(),
        passage_text: passage.trim(),
        question_type: "passage",
        marks: 1,
        status: "draft",
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        correct_option: "",
        position: base + 1,
      })
      .select("id")
      .single();

    if (error || !parent) {
      setBusy(false);
      toast.error("Could not save the passage");
      return;
    }

    const { error: childError } = await supabase.from("questions").insert(
      filled.map((s, i) => ({
        test_id: testId,
        passage_id: parent.id,
        question_text: s.text.trim(),
        question_type: "subjective" as const,
        marks: Math.max(1, Number(s.marks) || 1),
        status: "draft" as const,
        model_answer: s.modelAnswer.trim(),
        hint: s.hint.trim() || null,
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        correct_option: "",
        position: base + 2 + i,
      })),
    );

    setBusy(false);
    if (childError) {
      toast.error("Passage saved but sub-questions failed — please retry");
      return;
    }
    toast.success("Passage set saved as draft — publish it from Review & Publish");
    setTitle("");
    setPassage("");
    setSubs([emptySub(), emptySub()]);
    queryClient.invalidateQueries();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete passage set");
      return;
    }
    toast.success("Passage set deleted");
    queryClient.invalidateQueries();
  }

  return (
    <div className="space-y-4">
      <section className="surface-card p-5">
        <h2 className="inline-flex items-center gap-2 font-bold">
          <BookOpen className="h-4 w-4" /> New reading comprehension set
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Students see the passage at the top, then each sub-question with its own answer box.
          Saved as a draft — publish it from the “Review &amp; Publish” tab.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Select value={testId} onValueChange={setTestId}>
            <SelectTrigger>
              <SelectValue placeholder="Test" />
            </SelectTrigger>
            <SelectContent>
              {(tests.data ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Passage title, e.g. “Read the extract below”"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="mt-3">
          <Label htmlFor="passage-text">Passage / extract</Label>
          <Textarea
            id="passage-text"
            rows={10}
            className="mt-1 min-h-[200px]"
            placeholder="Paste the full paragraph or extract here…"
            value={passage}
            onChange={(e) => setPassage(e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {passage.length} characters
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {subs.map((sub, i) => (
            <div key={i} className="rounded-2xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Sub-question {i + 1}</p>
                {subs.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSubs((s) => s.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_110px]">
                <Textarea
                  placeholder="Question based on the passage"
                  value={sub.text}
                  onChange={(e) => setSub(i, { text: e.target.value })}
                />
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={sub.marks}
                  onChange={(e) => setSub(i, { marks: e.target.value })}
                  placeholder="Marks"
                />
              </div>
              <Textarea
                className="mt-2"
                placeholder="Model answer — shown to you while grading"
                value={sub.modelAnswer}
                onChange={(e) => setSub(i, { modelAnswer: e.target.value })}
              />
              <Input
                className="mt-2"
                placeholder="💡 VIP hint (optional)"
                value={sub.hint}
                onChange={(e) => setSub(i, { hint: e.target.value })}
              />
            </div>
          ))}
          <Button variant="outline" onClick={() => setSubs((s) => [...s, emptySub()])}>
            <Plus className="h-4 w-4" /> Add sub-question
          </Button>
        </div>

        <Button className="mt-4" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save passage set as draft"}
        </Button>
      </section>

      <section className="surface-card p-5">
        <h2 className="font-bold">Existing passage sets</h2>
        {(existing.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No passage sets yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {(existing.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">
                  {p.tests?.title} · {p.question_text}{" "}
                  <span className="text-xs text-muted-foreground">({p.status})</span>
                </span>
                <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
