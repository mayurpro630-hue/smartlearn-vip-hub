import { useState } from "react";
import { MessageSquarePlus, Pencil, Trash2, X, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Conversation } from "@/lib/chat";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
};

function List({ conversations, activeId, onSelect, onNew, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <div className="flex h-full flex-col gap-2">
      <Button size="sm" className="w-full" onClick={onNew}>
        <MessageSquarePlus className="h-4 w-4" /> New chat
      </Button>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {conversations.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Your saved chats will appear here.
          </p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
              c.id === activeId ? "bg-primary-soft text-primary" : "hover:bg-accent"
            }`}
          >
            {editing === c.id ? (
              <form
                className="flex-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) onRename(c.id, draft.trim());
                  setEditing(null);
                }}
              >
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => setEditing(null)}
                  className="h-7 text-sm"
                />
              </form>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="flex-1 truncate text-left"
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  aria-label="Rename chat"
                  className="opacity-60 hover:opacity-100"
                  onClick={() => {
                    setEditing(c.id);
                    setDraft(c.title);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Delete chat"
                  className="opacity-60 hover:text-destructive hover:opacity-100"
                  onClick={() => onDelete(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Sidebar on desktop, slide-over on phones. */
export function ChatHistory(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-border pr-3 md:block">
        <List {...props} />
      </aside>

      <Button
        variant="outline"
        size="sm"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open saved chats"
      >
        <PanelLeft className="h-4 w-4" /> Chats
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col gap-2 bg-background p-3 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Saved chats</p>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <List
                {...props}
                onSelect={(id) => {
                  props.onSelect(id);
                  setOpen(false);
                }}
                onNew={() => {
                  props.onNew();
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
