import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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

type Kind = "mcq" | "match" | "fill_blank" | "audio" | "speak";

export function EnglishCourseManager({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [levelId, setLevelId] = useState("");
  const [lessonId, setLessonId] = useState("");

  const levels = useQuery({
    queryKey: ["admin-english-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("english_levels")
        .select("id, level_number, title, subtitle")
        .order("level_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const lessons = useQuery({
    queryKey: ["admin-english-lessons", levelId],
    enabled: !!levelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("english_lessons")
        .select("id, title, description, position, xp_reward")
        .eq("level_id", levelId)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const exercises = useQuery({
    queryKey: ["admin-english-exercises", lessonId],
    enabled: !!lessonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("english_exercises")
        .select("id, kind, prompt, correct_answer, position")
        .eq("lesson_id", lessonId)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-english-lessons"] });
    qc.invalidateQueries({ queryKey: ["admin-english-exercises"] });
    qc.invalidateQueries({ queryKey: ["english-course"] });
    qc.invalidateQueries({ queryKey: ["english-lesson-count"] });
  }

  return (
    <div className="space-y-4">
      <div className="surface-card p-4">
        <Label>Level</Label>
        <Select
          value={levelId}
          onValueChange={(v) => {
            setLevelId(v);
            setLessonId("");
          }}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Choose a level" />
          </SelectTrigger>
          <SelectContent>
            {levels.data?.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                Level {l.level_number} — {l.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {levelId && (
        <div className="surface-card p-4">
          <p className="text-sm font-semibold">Lessons in this level</p>
          <div className="mt-3 divide-y divide-border">
            {lessons.data?.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLessonId(l.id)}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left ${
                  lessonId === l.id ? "text-primary" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{l.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {l.description}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{l.xp_reward} XP</span>
              </button>
            ))}
            {lessons.data?.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">No lessons yet.</p>
            )}
          </div>

          {canManage && (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget as HTMLFormElement);
                const { error } = await supabase.from("english_lessons").insert({
                  level_id: levelId,
                  title: String(f.get("title") ?? ""),
                  description: String(f.get("description") ?? ""),
                  xp_reward: Number(f.get("xp") ?? 20),
                  position: (lessons.data?.length ?? 0) + 1,
                });
                if (error) {
                  toast.error("Could not add lesson");
                  return;
                }
                toast.success("Lesson added");
                (e.target as HTMLFormElement).reset();
                invalidate();
              }}
            >
              <div className="sm:col-span-2">
                <Label htmlFor="en-lesson-title">New lesson title</Label>
                <Input id="en-lesson-title" name="title" required />
              </div>
              <div>
                <Label htmlFor="en-lesson-desc">Description</Label>
                <Input id="en-lesson-desc" name="description" />
              </div>
              <div>
                <Label htmlFor="en-lesson-xp">XP reward</Label>
                <Input id="en-lesson-xp" name="xp" type="number" min={5} defaultValue={20} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm">
                  <Plus className="h-4 w-4" /> Add lesson
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {lessonId && (
        <div className="surface-card p-4">
          <p className="text-sm font-semibold">Exercises</p>
          <div className="mt-3 divide-y divide-border">
            {exercises.data?.map((x) => (
              <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{x.prompt}</p>
                  <p className="text-xs text-muted-foreground">
                    {x.kind} · answer: {x.correct_answer ?? "—"}
                  </p>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete exercise"
                    onClick={async () => {
                      const { error } = await supabase
                        .from("english_exercises")
                        .delete()
                        .eq("id", x.id);
                      if (error) {
                        toast.error("Could not delete");
                        return;
                      }
                      toast.success("Exercise removed");
                      invalidate();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {exercises.data?.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">No exercises yet.</p>
            )}
          </div>

          <ExerciseForm lessonId={lessonId} count={exercises.data?.length ?? 0} onDone={invalidate} />
        </div>
      )}
    </div>
  );
}

function ExerciseForm({
  lessonId,
  count,
  onDone,
}: {
  lessonId: string;
  count: number;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<Kind>("mcq");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        const f = new FormData(form);
        setBusy(true);
        const optionsRaw = String(f.get("options") ?? "").trim();
        const pairsRaw = String(f.get("pairs") ?? "").trim();
        const options = optionsRaw
          ? optionsRaw.split("\n").map((s) => s.trim()).filter(Boolean)
          : [];
        const pairs = pairsRaw
          ? pairsRaw
              .split("\n")
              .map((line) => line.split("=").map((s) => s.trim()))
              .filter((p) => p.length === 2 && p[0] && p[1])
              .map(([left, right]) => ({ left, right }))
          : [];
        const { error } = await supabase.from("english_exercises").insert({
          lesson_id: lessonId,
          kind,
          prompt: String(f.get("prompt") ?? ""),
          helper_text: String(f.get("helper") ?? "") || null,
          options,
          pairs,
          correct_answer: String(f.get("answer") ?? "") || null,
          audio_text: String(f.get("audio") ?? "") || null,
          explanation: String(f.get("explanation") ?? "") || null,
          position: count + 1,
        });
        setBusy(false);
        if (error) {
          toast.error("Could not add exercise");
          return;
        }
        toast.success("Exercise added");
        form.reset();
        onDone();
      }}
    >
      <div>
        <Label>Exercise type</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mcq">Multiple choice</SelectItem>
            <SelectItem value="match">Matching pairs</SelectItem>
            <SelectItem value="fill_blank">Fill in the blank</SelectItem>
            <SelectItem value="audio">Listen and choose</SelectItem>
            <SelectItem value="speak">Speaking practice</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="en-ex-answer">Correct answer</Label>
        <Input id="en-ex-answer" name="answer" placeholder="e.g. Apple" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="en-ex-prompt">Question / prompt</Label>
        <Textarea id="en-ex-prompt" name="prompt" rows={2} required />
      </div>
      <div>
        <Label htmlFor="en-ex-options">Options (one per line)</Label>
        <Textarea id="en-ex-options" name="options" rows={3} />
      </div>
      <div>
        <Label htmlFor="en-ex-pairs">Pairs (Left = Right, one per line)</Label>
        <Textarea id="en-ex-pairs" name="pairs" rows={3} />
      </div>
      <div>
        <Label htmlFor="en-ex-audio">Text to speak aloud</Label>
        <Input id="en-ex-audio" name="audio" placeholder="Used for listen / speak exercises" />
      </div>
      <div>
        <Label htmlFor="en-ex-helper">Helper text</Label>
        <Input id="en-ex-helper" name="helper" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="en-ex-expl">Explanation</Label>
        <Textarea id="en-ex-expl" name="explanation" rows={2} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={busy}>
          <Plus className="h-4 w-4" /> {busy ? "Saving…" : "Add exercise"}
        </Button>
      </div>
    </form>
  );
}
