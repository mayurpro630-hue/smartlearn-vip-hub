import { supabase } from "@/integrations/supabase/client";

export type Assistant = "student" | "admin";

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export async function listConversations(assistant: Assistant) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("assistant", assistant)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function createConversation(
  assistant: Assistant,
  userId: string,
  title = "New chat",
) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ assistant, user_id: userId, title: title.slice(0, 80) })
    .select("id, title, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as Conversation;
}

export async function renameConversation(id: string, title: string) {
  const { error } = await supabase
    .from("ai_conversations")
    .update({ title: title.slice(0, 80), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteConversation(id: string) {
  const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function listMessages(conversationId: string) {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, content, image_url, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as StoredMessage[];
}

export async function addMessage(
  conversationId: string,
  userId: string,
  role: "user" | "assistant",
  content: string,
  imageUrl?: string | null,
) {
  const { error } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role,
    content,
    image_url: imageUrl ?? null,
  });
  if (error) throw error;
  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

/** Uploads a photo to the private chat bucket and returns its storage path. */
export async function uploadChatImage(file: File, userId: string) {
  if (!file.type.startsWith("image/")) throw new Error("Please pick a photo.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("That photo is too large (max 8 MB).");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("chat-uploads").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function signedImageUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("chat-uploads")
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function titleFromText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 60) || "New chat";
}
