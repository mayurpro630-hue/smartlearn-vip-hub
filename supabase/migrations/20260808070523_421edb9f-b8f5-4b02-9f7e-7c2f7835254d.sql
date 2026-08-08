-- question type + draft/publish + subjective support
DO $$ BEGIN
  CREATE TYPE public.question_kind AS ENUM ('mcq','subjective');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.publish_status AS ENUM ('draft','published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_type public.question_kind NOT NULL DEFAULT 'mcq',
  ADD COLUMN IF NOT EXISTS model_answer text,
  ADD COLUMN IF NOT EXISTS marks integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status public.publish_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- existing questions stay live
UPDATE public.questions SET status = 'published', published_at = now() WHERE status = 'draft';

-- students only see published questions
DROP POLICY IF EXISTS "questions auth read" ON public.questions;
CREATE POLICY "questions auth read" ON public.questions
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'::app_role));

-- subjective answers + manual grading + per-question timing
ALTER TABLE public.attempt_answers
  ADD COLUMN IF NOT EXISTS answer_text text,
  ADD COLUMN IF NOT EXISTS awarded_marks integer,
  ADD COLUMN IF NOT EXISTS graded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer NOT NULL DEFAULT 0;

CREATE POLICY "admin grades answers" ON public.attempt_answers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));