import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, CheckCircle2, Send, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runAdminCopilot } from "@/lib/copilot.functions";
import { useAuth } from "@/lib/auth";

type Msg = { role: "user" | "assistant"; content: string; actions?: string[] };

const EXAMPLES = [
  "Add a new subject: 10th Grade History",
  "Add a lesson on Linear Equations under Mathematics and generate 5 practice MCQs",
  "Show me all tests in Mathematics with their draft counts",
  "Publish all draft questions in the Linear Equations test",
];

export function AdminCopilot() {
  const { isSuperAdmin } = useAuth();
  const askCopilot = useServerFn(runAdminCopilot);
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  if (!isSuperAdmin) return null;

  const send = async (text: string) => {
    const command = text.trim();
    if (!command || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: command }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await askCopilot({
        data: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (!res.ok) {
        toast.error(res.error);
        setMessages((prev) => [...prev, { role: "assistant", content: res.error }]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, actions: res.actions },
      ]);
      if (res.actions && res.actions.length > 0) {
        toast.success(res.actions[0]!);
        queryClient.invalidateQueries();
      }
    } catch (error) {
      console.error(error);
      toast.error("The copilot could not run that command.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="surface-card p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">AI Admin Copilot</h2>
          <p className="text-sm text-muted-foreground">
            Type a command and it will create, update or remove content for you. It only acts when
            you send a message.
          </p>
        </div>
      </div>

      <div
        ref={boxRef}
        className="mt-4 max-h-[420px] min-h-[220px] space-y-3 overflow-y-auto rounded-xl border bg-muted/30 p-3"
      >
        {messages.length === 0 && (
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium">Try one of these:</p>
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => send(e)}
                className="block w-full rounded-lg border bg-background px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-primary/10 p-1.5 text-primary">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border bg-background"
              }`}
            >
              {m.content}
              {m.actions && m.actions.length > 0 && (
                <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                  {m.actions.map((a, j) => (
                    <li key={j} className="flex items-start gap-1.5">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {m.role === "user" && (
              <div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-muted p-1.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="h-4 w-4 animate-pulse" />
            Working on your command…
          </div>
        )}
      </div>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder='e.g. "Add a lesson on Linear Equations under Mathematics and generate 5 MCQs"'
          rows={2}
          className="min-h-[56px] resize-none"
          disabled={busy}
        />
        <Button type="submit" size="icon" className="h-[56px] w-12" disabled={busy || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
