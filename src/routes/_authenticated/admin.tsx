import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { claimAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionReview } from "@/components/admin/QuestionReview";
import { ManualGrading } from "@/components/admin/ManualGrading";
import { TestAnalytics, AttemptBreakdown } from "@/components/admin/TestAnalytics";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Mayur Education" },
      {
        name: "description",
        content: "Manage subjects, chapters, tests and questions, and monitor student activity.",
      },
      { property: "og:title", content: "Admin Panel — Mayur Education" },
      { property: "og:description", content: "Content management and student monitoring." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { isAdmin, refreshProfile } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="surface-card p-6">
          <h1 className="text-xl font-bold">Admin access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the admin access code to unlock the panel.
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const res = await claimAdmin({ data: { code } });
              setBusy(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("Admin access granted");
              refreshProfile();
            }}
          >
            <div>
              <Label htmlFor="code">Access code</Label>
              <Input
                id="code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Checking…" : "Unlock admin panel"}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Admin panel</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage content and monitor student activity.
      </p>

      <Tabs defaultValue="content" className="mt-6">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="content" className="flex-1">
            Content
          </TabsTrigger>
          <TabsTrigger value="review" className="flex-1">
            Review &amp; Publish
          </TabsTrigger>
          <TabsTrigger value="grading" className="flex-1">
            Manual Grading
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1">
            Analytics
          </TabsTrigger>
          <TabsTrigger value="students" className="flex-1">
            Students
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex-1">
            Reports
          </TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="mt-4">
          <ContentManager />
        </TabsContent>
        <TabsContent value="review" className="mt-4">
          <QuestionReview />
        </TabsContent>
        <TabsContent value="grading" className="mt-4">
          <ManualGrading />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <TestAnalytics />
        </TabsContent>
        <TabsContent value="students" className="mt-4">
          <StudentMonitor />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <Reports />
        </TabsContent>
      </Tabs>

    </main>
  );
}

function ContentManager() {
  const queryClient = useQueryClient();
  const [subjectName, setSubjectName] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [chapterSubject, setChapterSubject] = useState("");
  const [testTitle, setTestTitle] = useState("");
  const [testChapter, setTestChapter] = useState("");
  const [testDuration, setTestDuration] = useState("10");
  const [qTest, setQTest] = useState("");
  const [qText, setQText] = useState("");
  const [opts, setOpts] = useState({ A: "", B: "", C: "", D: "" });
  const [correct, setCorrect] = useState("A");
  const [hint, setHint] = useState("");
  const [explanation, setExplanation] = useState("");
  const [qType, setQType] = useState<"mcq" | "subjective">("mcq");
  const [qMarks, setQMarks] = useState("1");
  const [modelAnswer, setModelAnswer] = useState("");


  const tree = useQuery({
    queryKey: ["admin-tree"],
    queryFn: async () => {
      const [subjects, chapters, tests] = await Promise.all([
        supabase.from("subjects").select("id, name").order("name"),
        supabase.from("chapters").select("id, name, subject_id").order("name"),
        supabase
          .from("tests")
          .select("id, title, chapter_id, duration_minutes, questions(id)")
          .order("title"),
      ]);
      if (subjects.error || chapters.error || tests.error) {
        throw subjects.error ?? chapters.error ?? tests.error;
      }
      return {
        subjects: subjects.data ?? [],
        chapters: chapters.data ?? [],
        tests: tests.data ?? [],
      };
    },
  });

  const refresh = () => queryClient.invalidateQueries();

  async function run(promise: PromiseLike<{ error: unknown }>, ok: string) {
    const { error } = await promise;
    if (error) {
      toast.error("Action failed — check required fields");
      return false;
    }
    toast.success(ok);
    refresh();
    return true;
  }

  const subjects = tree.data?.subjects ?? [];
  const chapters = tree.data?.chapters ?? [];
  const tests = tree.data?.tests ?? [];

  return (
    <div className="space-y-4">
      <section className="surface-card p-5">
        <h2 className="font-bold">Subjects</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Subject name"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
          />
          <Button
            onClick={async () => {
              if (!subjectName.trim()) return;
              if (await run(supabase.from("subjects").insert({ name: subjectName.trim() }), "Subject added"))
                setSubjectName("");
            }}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-border text-sm">
          {subjects.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">{s.name}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => run(supabase.from("subjects").delete().eq("id", s.id), "Subject deleted")}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card p-5">
        <h2 className="font-bold">Chapters</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Select value={chapterSubject} onValueChange={setChapterSubject}>
            <SelectTrigger>
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Chapter name"
            value={chapterName}
            onChange={(e) => setChapterName(e.target.value)}
          />
          <Button
            onClick={async () => {
              if (!chapterSubject || !chapterName.trim()) return;
              if (
                await run(
                  supabase
                    .from("chapters")
                    .insert({ name: chapterName.trim(), subject_id: chapterSubject }),
                  "Chapter added",
                )
              )
                setChapterName("");
            }}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-border text-sm">
          {chapters.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">
                {subjects.find((s) => s.id === c.subject_id)?.name} · {c.name}
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => run(supabase.from("chapters").delete().eq("id", c.id), "Chapter deleted")}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card p-5">
        <h2 className="font-bold">Tests</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto]">
          <Select value={testChapter} onValueChange={setTestChapter}>
            <SelectTrigger>
              <SelectValue placeholder="Chapter" />
            </SelectTrigger>
            <SelectContent>
              {chapters.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {subjects.find((s) => s.id === c.subject_id)?.name} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Test title"
            value={testTitle}
            onChange={(e) => setTestTitle(e.target.value)}
          />
          <Input
            type="number"
            min={1}
            max={180}
            value={testDuration}
            onChange={(e) => setTestDuration(e.target.value)}
          />
          <Button
            onClick={async () => {
              if (!testChapter || !testTitle.trim()) return;
              if (
                await run(
                  supabase.from("tests").insert({
                    title: testTitle.trim(),
                    chapter_id: testChapter,
                    duration_minutes: Math.max(1, Number(testDuration) || 10),
                  }),
                  "Test added",
                )
              )
                setTestTitle("");
            }}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-border text-sm">
          {tests.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">
                {t.title} · {t.duration_minutes} min · {t.questions?.length ?? 0} questions
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => run(supabase.from("tests").delete().eq("id", t.id), "Test deleted")}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card p-5">
        <h2 className="font-bold">Add question</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          New questions are saved as <strong>drafts</strong> — verify them in the “Review &amp;
          Publish” tab to make them live.
        </p>
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_120px]">
            <Select value={qTest} onValueChange={setQTest}>
              <SelectTrigger>
                <SelectValue placeholder="Test" />
              </SelectTrigger>
              <SelectContent>
                {tests.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={qType} onValueChange={(v) => setQType(v as "mcq" | "subjective")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">MCQ (options)</SelectItem>
                <SelectItem value="subjective">Subjective (long answer)</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={100}
              value={qMarks}
              onChange={(e) => setQMarks(e.target.value)}
              placeholder="Marks"
            />
          </div>
          <Textarea
            placeholder="Question text"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
          />

          {qType === "mcq" ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["A", "B", "C", "D"] as const).map((l) => (
                  <Input
                    key={l}
                    placeholder={`Option ${l}`}
                    value={opts[l]}
                    onChange={(e) => setOpts((o) => ({ ...o, [l]: e.target.value }))}
                  />
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                <Select value={correct} onValueChange={setCorrect}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["A", "B", "C", "D"] as const).map((l) => (
                      <SelectItem key={l} value={l}>
                        Correct: {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="💡 VIP hint (optional)"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <Textarea
                placeholder="Model answer — shown to you while grading"
                value={modelAnswer}
                onChange={(e) => setModelAnswer(e.target.value)}
                rows={4}
              />
              <Input
                placeholder="💡 VIP hint (optional)"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
              />
            </>
          )}

          <Textarea
            placeholder="Explanation (optional)"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
          <Button
            onClick={async () => {
              if (!qTest || !qText.trim()) {
                toast.error("Choose a test and enter the question text");
                return;
              }
              if (qType === "mcq" && (!opts.A.trim() || !opts.B.trim())) {
                toast.error("MCQ questions need at least options A and B");
                return;
              }
              if (qType === "subjective" && !modelAnswer.trim()) {
                toast.error("Add a model answer so you can grade it later");
                return;
              }
              const count = tests.find((t) => t.id === qTest)?.questions?.length ?? 0;
              const ok = await run(
                supabase.from("questions").insert({
                  test_id: qTest,
                  question_text: qText.trim(),
                  question_type: qType,
                  marks: Math.max(1, Number(qMarks) || 1),
                  status: "draft",
                  model_answer: qType === "subjective" ? modelAnswer.trim() : null,
                  option_a: qType === "mcq" ? opts.A.trim() : "",
                  option_b: qType === "mcq" ? opts.B.trim() : "",
                  option_c: qType === "mcq" ? opts.C.trim() : "",
                  option_d: qType === "mcq" ? opts.D.trim() : "",
                  correct_option: qType === "mcq" ? correct : "",
                  hint: hint.trim() || null,
                  explanation: explanation.trim() || null,
                  position: count + 1,
                }),
                "Saved as draft — publish it from the Review & Publish tab",
              );
              if (ok) {
                setQText("");
                setOpts({ A: "", B: "", C: "", D: "" });
                setHint("");
                setExplanation("");
                setModelAnswer("");
              }
            }}
          >
            <Plus className="h-4 w-4" /> Save as draft
          </Button>
        </div>
      </section>

    </div>
  );
}

function StudentMonitor() {
  const [search, setSearch] = useState("");
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);


  const students = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, is_vip, streak, total_score, tests_taken")
        .order("total_score", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const attempts = useQuery({
    queryKey: ["admin-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_attempts")
        .select(
          "id, user_id, correct_count, total_questions, tab_switch_count, time_spent_seconds, created_at, tests(title)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const term = search.trim().toLowerCase();
  const rows = (students.data ?? []).filter((s) =>
    term ? s.username.toLowerCase().includes(term) : true,
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search students by username…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="surface-card divide-y divide-border">
        {rows.map((s) => {
          const mine = (attempts.data ?? []).filter((a) => a.user_id === s.id);
          const flags = mine.reduce((acc, a) => acc + a.tab_switch_count, 0);
          return (
            <div key={s.id} className="p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <p className="min-w-0 truncate font-semibold">
                  {s.username}
                  {s.is_vip && <Crown className="ml-1.5 inline h-4 w-4 text-gold" />}
                </p>
                <p className="shrink-0 text-sm text-muted-foreground">
                  {s.total_score} marks · {s.tests_taken} tests · streak {s.streak}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Anti-cheating flags: <strong className="text-destructive">{flags}</strong>
              </p>
              {mine.length > 0 && (
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {mine.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      <button
                        className="w-full truncate rounded-md px-1 py-0.5 text-left hover:bg-accent"
                        onClick={() => setOpenAttempt((o) => (o === a.id ? null : a.id))}
                      >
                        {new Date(a.created_at).toLocaleString()} · {a.tests?.title} ·{" "}
                        {a.correct_count}/{a.total_questions} · {a.tab_switch_count} switches ·{" "}
                        {Math.round(a.time_spent_seconds / 60)}m
                      </button>
                      {openAttempt === a.id && <AttemptBreakdown attemptId={a.id} />}
                    </li>
                  ))}
                </ul>
              )}

            </div>
          );
        })}
        {!students.isLoading && rows.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No students found.</p>
        )}
      </div>
    </div>
  );
}

function Reports() {
  const q = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("error_reports")
        .select("id, message, created_at, questions(question_text)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = q.data ?? [];

  return (
    <div className="surface-card divide-y divide-border">
      {rows.map((r) => (
        <div key={r.id} className="p-4">
          <p className="text-sm font-semibold">{r.questions?.question_text}</p>
          <p className="mt-1 text-sm text-muted-foreground">{r.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(r.created_at).toLocaleString()}
          </p>
        </div>
      ))}
      {!q.isLoading && rows.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">No error reports.</p>
      )}
    </div>
  );
}
