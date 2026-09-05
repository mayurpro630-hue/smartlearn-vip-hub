import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, Mic, Send, Volume2 } from "lucide-react";
import { askMayurTutor } from "@/lib/english-ai.functions";
import { getRecognition, speak } from "@/lib/english";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/english/tutor")({
  head: () => ({
    meta: [
      { title: "Mayur, your English tutor — Mayur Education" },
      {
        name: "description",
        content:
          "Chat with Mayur, a friendly AI English tutor. Practise speaking, fix grammar and learn pronunciation in simple English.",
      },
      { property: "og:title", content: "Mayur, your English tutor" },
      {
        property: "og:description",
        content: "Practise real English conversation with instant, gentle corrections.",
      },
    ],
  }),
  component: TutorChat,
});

type Turn = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "Hello Mayur, I want to practise English.",
  "How do I introduce myself in an interview?",
  "How do I say 'comfortable' correctly?",
  "Correct my sentence: I am go to market yesterday.",
];

function TutorChat() {
  const ask = useServerFn(askMayurTutor);
  const [messages, setMessages] = useState<Turn[]>([
    {
      role: "assistant",
      content:
        "Hi! I am Mayur, your English speaking partner. 🙂 Tell me anything in English, Marathi or Hindi and we will practise together. What would you like to talk about today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const next: Turn[] = [...messages, { role: "user", content: message }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await ask({ data: { messages: next.filter((m) => m.content) } });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        setMessages([...next, { role: "assistant", content: res.reply }]);
      }
    } catch {
      toast.error("Could not reach Mayur just now.");
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    const rec = getRecognition("en-IN");
    if (!rec) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }
    setListening(true);
    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript ?? "";
      setInput((prev) => (prev ? `${prev} ${text}` : text));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-8rem)] max-w-2xl flex-col px-4 py-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back">
          <Link to="/english">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="hero-gradient grid h-9 w-9 shrink-0 place-items-center rounded-xl">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-bold">Mayur — English tutor</h1>
          <p className="text-[11px] text-muted-foreground">
            Speak or type. He replies in simple English.
          </p>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {m.content}
              </p>
            ) : (
              <div className="max-w-[92%]">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {m.content}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    if (!speak(m.content)) toast.error("Audio is not supported here.");
                  }}
                >
                  <Volume2 className="h-3.5 w-3.5" /> Listen
                </Button>
              </div>
            )}
          </div>
        ))}
        {busy && <p className="animate-pulse text-sm text-muted-foreground">Mayur is typing…</p>}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/60"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          rows={2}
          className="min-h-[52px] flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Speak"
          onClick={startListening}
          disabled={listening}
        >
          <Mic className={`h-4 w-4 ${listening ? "text-destructive" : ""}`} />
        </Button>
        <Button type="submit" size="icon" aria-label="Send" disabled={busy || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </main>
  );
}
