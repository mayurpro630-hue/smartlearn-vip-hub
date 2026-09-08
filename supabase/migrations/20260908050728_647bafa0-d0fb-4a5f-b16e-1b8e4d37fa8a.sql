CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant text NOT NULL DEFAULT 'student' CHECK (assistant IN ('student','admin')),
  title text NOT NULL DEFAULT 'New chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations" ON public.ai_conversations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ai_conversations_user_idx ON public.ai_conversations (user_id, assistant, updated_at DESC);

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.ai_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE INDEX ai_messages_conversation_idx ON public.ai_messages (conversation_id, created_at);

CREATE TRIGGER ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.english_lessons
  ADD COLUMN IF NOT EXISTS title_mr text,
  ADD COLUMN IF NOT EXISTS description_mr text;

ALTER TABLE public.english_exercises
  ADD COLUMN IF NOT EXISTS prompt_mr text,
  ADD COLUMN IF NOT EXISTS meaning_mr text,
  ADD COLUMN IF NOT EXISTS pronunciation_mr text,
  ADD COLUMN IF NOT EXISTS hint_mr text,
  ADD COLUMN IF NOT EXISTS media text;

ALTER TYPE public.english_exercise_kind ADD VALUE IF NOT EXISTS 'build';