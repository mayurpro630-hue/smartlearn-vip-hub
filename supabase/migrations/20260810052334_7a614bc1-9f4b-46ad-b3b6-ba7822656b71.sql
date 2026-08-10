ALTER TYPE question_kind ADD VALUE IF NOT EXISTS 'passage';

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS passage_text text,
  ADD COLUMN IF NOT EXISTS passage_id uuid REFERENCES public.questions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS questions_passage_id_idx ON public.questions(passage_id);