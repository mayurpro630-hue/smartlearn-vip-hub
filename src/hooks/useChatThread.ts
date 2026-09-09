import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addMessage,
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  renameConversation,
  signedImageUrl,
  titleFromText,
  type Assistant,
  type Conversation,
} from "@/lib/chat";

export type ThreadMessage = {
  role: "user" | "assistant";
  content: string;
  imagePath?: string | null;
  imageUrl?: string | null;
};

/** Saved chat history for one assistant: list, open, rename, delete, append. */
export function useChatThread(assistant: Assistant, userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setConversations(await listConversations(assistant));
    } catch {
      /* history is optional — never block the chat */
    }
  }, [assistant, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = useCallback(async (id: string) => {
    setActiveId(id);
    setLoading(true);
    try {
      const rows = await listMessages(id);
      const withUrls = await Promise.all(
        rows.map(async (m) => ({
          role: m.role,
          content: m.content,
          imagePath: m.image_url,
          imageUrl: m.image_url ? await signedImageUrl(m.image_url) : null,
        })),
      );
      setMessages(withUrls);
    } catch {
      toast.error("Could not open that chat.");
    } finally {
      setLoading(false);
    }
  }, []);

  const startNew = useCallback(() => {
    setActiveId(null);
    setMessages([]);
  }, []);

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
        if (id === activeId) startNew();
        await refresh();
      } catch {
        toast.error("Could not delete that chat.");
      }
    },
    [activeId, refresh, startNew],
  );

  const rename = useCallback(
    async (id: string, title: string) => {
      try {
        await renameConversation(id, title);
        await refresh();
      } catch {
        toast.error("Could not rename that chat.");
      }
    },
    [refresh],
  );

  /** Saves a turn, creating the conversation on the first message. */
  const save = useCallback(
    async (
      role: "user" | "assistant",
      content: string,
      imagePath?: string | null,
    ): Promise<string | null> => {
      if (!userId) return activeId;
      try {
        let id = activeId;
        if (!id) {
          const convo = await createConversation(assistant, userId, titleFromText(content));
          id = convo.id;
          setActiveId(id);
        }
        await addMessage(id, role, content, imagePath ?? null);
        void refresh();
        return id;
      } catch {
        return activeId;
      }
    },
    [activeId, assistant, refresh, userId],
  );

  return {
    conversations,
    activeId,
    messages,
    setMessages,
    loading,
    open,
    startNew,
    remove,
    rename,
    save,
  };
}
