import { useEffect, useRef, useState } from "react";
import { Copy, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/copy";

type Lang = "en-IN" | "mr-IN";

const LANGS: { code: Lang; label: string }[] = [
  { code: "en-IN", label: "English" },
  { code: "mr-IN", label: "मराठी" },
];

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]) as
    | (new () => SpeechRecognitionLike)
    | null;
}

/**
 * Answer box with dictation (English + Marathi) and a copy button.
 * Dictation works for both languages: the language is passed to the
 * recognizer explicitly, so neither one is disabled.
 */
export function VoiceTextarea({
  id,
  value,
  onChange,
  rows = 8,
  placeholder,
  maxLength = 5000,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}) {
  const [lang, setLang] = useState<Lang>("en-IN");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      toast.error("Voice typing is not supported in this browser — use the keyboard mic key");
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) chunk += e.results[i][0].transcript;
      }
      if (!chunk.trim()) return;
      const base = valueRef.current;
      const next = (base ? `${base.replace(/\s+$/, "")} ` : "") + chunk.trim();
      onChange(next.slice(0, maxLength));
    };
    rec.onerror = (e: any) => {
      setListening(false);
      recognitionRef.current = null;
      toast.error(
        e?.error === "not-allowed"
          ? "Microphone permission denied — allow mic access in your browser settings"
          : "Voice input stopped. Please try again.",
      );
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                if (listening) stop();
                setLang(l.code);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant={listening ? "destructive" : "outline"}
          onClick={() => (listening ? stop() : start())}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {listening ? "Stop" : supported ? "Speak" : "Mic"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void copyText(value, "Answer copied")}
        >
          <Copy className="h-4 w-4" /> Copy
        </Button>
      </div>
      <Textarea
        id={id}
        rows={rows}
        maxLength={maxLength}
        lang={lang.startsWith("mr") ? "mr" : "en"}
        inputMode="text"
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck
        className="min-h-[160px] select-text text-base"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{listening ? `Listening in ${lang === "mr-IN" ? "Marathi" : "English"}…` : ""}</span>
        <span>
          {value.length}/{maxLength} characters
        </span>
      </div>
    </div>
  );
}
