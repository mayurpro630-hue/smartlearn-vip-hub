-- ENUM for exercise kinds
CREATE TYPE public.english_exercise_kind AS ENUM ('mcq', 'match', 'fill_blank', 'audio', 'speak');

-- LEVELS
CREATE TABLE public.english_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number integer NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  description text,
  color text NOT NULL DEFAULT 'primary',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.english_levels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_levels TO authenticated;
GRANT ALL ON public.english_levels TO service_role;
ALTER TABLE public.english_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "english levels public read" ON public.english_levels FOR SELECT USING (true);
CREATE POLICY "admin manage english levels" ON public.english_levels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- LESSONS
CREATE TABLE public.english_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES public.english_levels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  icon text,
  xp_reward integer NOT NULL DEFAULT 20,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.english_lessons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_lessons TO authenticated;
GRANT ALL ON public.english_lessons TO service_role;
ALTER TABLE public.english_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "english lessons public read" ON public.english_lessons FOR SELECT USING (true);
CREATE POLICY "admin manage english lessons" ON public.english_lessons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- EXERCISES
CREATE TABLE public.english_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.english_lessons(id) ON DELETE CASCADE,
  kind public.english_exercise_kind NOT NULL DEFAULT 'mcq',
  prompt text NOT NULL,
  helper_text text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  pairs jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text,
  audio_text text,
  explanation text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_exercises TO authenticated;
GRANT ALL ON public.english_exercises TO service_role;
ALTER TABLE public.english_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "english exercises auth read" ON public.english_exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage english exercises" ON public.english_exercises FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- STATS
CREATE TABLE public.english_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  lessons_completed integer NOT NULL DEFAULT 0,
  last_active_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.english_stats TO anon;
GRANT SELECT, INSERT, UPDATE ON public.english_stats TO authenticated;
GRANT ALL ON public.english_stats TO service_role;
ALTER TABLE public.english_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "english stats public read" ON public.english_stats FOR SELECT USING (true);
CREATE POLICY "insert own english stats" ON public.english_stats FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own english stats" ON public.english_stats FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- PROGRESS
CREATE TABLE public.english_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.english_lessons(id) ON DELETE CASCADE,
  correct_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 1,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE ON public.english_progress TO authenticated;
GRANT ALL ON public.english_progress TO service_role;
ALTER TABLE public.english_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own english progress" ON public.english_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert own english progress" ON public.english_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own english progress" ON public.english_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- XP + STREAK MAINTENANCE
CREATE OR REPLACE FUNCTION public.apply_english_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last date;
  v_streak integer;
  v_longest integer;
BEGIN
  INSERT INTO public.english_stats (user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT last_active_date, current_streak, longest_streak
    INTO v_last, v_streak, v_longest
  FROM public.english_stats WHERE user_id = NEW.user_id;

  IF v_last IS NULL THEN
    v_streak := 1;
  ELSIF v_last = current_date THEN
    v_streak := GREATEST(v_streak, 1);
  ELSIF v_last = current_date - 1 THEN
    v_streak := v_streak + 1;
  ELSE
    v_streak := 1;
  END IF;

  UPDATE public.english_stats SET
    xp = xp + GREATEST(NEW.xp_earned, 0),
    lessons_completed = (SELECT count(*) FROM public.english_progress WHERE user_id = NEW.user_id),
    current_streak = v_streak,
    longest_streak = GREATEST(COALESCE(v_longest, 0), v_streak),
    last_active_date = current_date,
    updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_english_progress_insert
AFTER INSERT ON public.english_progress
FOR EACH ROW EXECUTE FUNCTION public.apply_english_progress();

CREATE TRIGGER on_english_progress_update
AFTER UPDATE ON public.english_progress
FOR EACH ROW WHEN (NEW.xp_earned > OLD.xp_earned) EXECUTE FUNCTION public.apply_english_progress();

CREATE TRIGGER update_english_levels_updated_at BEFORE UPDATE ON public.english_levels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_english_lessons_updated_at BEFORE UPDATE ON public.english_lessons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_english_exercises_updated_at BEFORE UPDATE ON public.english_exercises
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEED CONTENT ============
INSERT INTO public.english_levels (level_number, title, subtitle, description, color, position) VALUES
 (1, 'Basic', 'Alphabets & first words', 'Learn A-Z, everyday vocabulary, fruits, animals and basic greetings.', 'primary', 1),
 (2, 'Beginner', 'Sentences & grammar', 'Build correct sentences, learn basic grammar and the three tenses.', 'success', 2),
 (3, 'Intermediate', 'Daily conversations', 'Talk with friends, teachers and shopkeepers. Ask good questions.', 'warning', 3),
 (4, 'Advanced', 'Professional English', 'Corporate English, email drafting, presentations and interview practice.', 'gold', 4);

-- LEVEL 1
WITH l AS (SELECT id FROM public.english_levels WHERE level_number = 1)
INSERT INTO public.english_lessons (level_id, title, description, icon, xp_reward, position)
SELECT l.id, x.title, x.description, x.icon, x.xp, x.pos FROM l, (VALUES
 ('Alphabets A–Z', 'Recognise letters and their sounds.', 'ALetter', 20, 1),
 ('Fruits & Vegetables', 'Name common fruits and vegetables in English.', 'Apple', 20, 2),
 ('Animals & Birds', 'Learn animal and bird names.', 'PawPrint', 20, 3),
 ('Greetings & Politeness', 'Say hello, thank you and sorry correctly.', 'Handshake', 25, 4)
) AS x(title, description, icon, xp, pos);

-- LEVEL 2
WITH l AS (SELECT id FROM public.english_levels WHERE level_number = 2)
INSERT INTO public.english_lessons (level_id, title, description, icon, xp_reward, position)
SELECT l.id, x.title, x.description, x.icon, x.xp, x.pos FROM l, (VALUES
 ('Sentence Formation', 'Subject + verb + object made simple.', 'Blocks', 25, 1),
 ('Articles & Prepositions', 'Use a, an, the, in, on, at correctly.', 'Type', 25, 2),
 ('Present, Past & Future', 'The three basic tenses in daily use.', 'Clock', 30, 3)
) AS x(title, description, icon, xp, pos);

-- LEVEL 3
WITH l AS (SELECT id FROM public.english_levels WHERE level_number = 3)
INSERT INTO public.english_lessons (level_id, title, description, icon, xp_reward, position)
SELECT l.id, x.title, x.description, x.icon, x.xp, x.pos FROM l, (VALUES
 ('Talking with Friends', 'Casual conversation openers and replies.', 'Users', 30, 1),
 ('At School & with Teachers', 'Polite classroom English.', 'GraduationCap', 30, 2),
 ('At the Market', 'Ask prices, bargain and buy.', 'ShoppingBasket', 30, 3),
 ('Asking Questions', 'What, where, when, why, how.', 'HelpCircle', 35, 4)
) AS x(title, description, icon, xp, pos);

-- LEVEL 4
WITH l AS (SELECT id FROM public.english_levels WHERE level_number = 4)
INSERT INTO public.english_lessons (level_id, title, description, icon, xp_reward, position)
SELECT l.id, x.title, x.description, x.icon, x.xp, x.pos FROM l, (VALUES
 ('Corporate Vocabulary', 'Words you hear in every office.', 'Briefcase', 35, 1),
 ('Email Drafting', 'Write clear professional emails.', 'Mail', 40, 2),
 ('Presentations', 'Open, explain and close a presentation.', 'Presentation', 40, 3),
 ('Interview Preparation', 'Answer common interview questions.', 'UserCheck', 45, 4)
) AS x(title, description, icon, xp, pos);

-- EXERCISES: Alphabets
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Alphabets A–Z')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','Which letter comes after "M"?',NULL,'["L","N","O","P"]','[]','N',NULL,'The order is L, M, N, O.',1),
 ('mcq','Which of these is a vowel?',NULL,'["B","K","E","T"]','[]','E',NULL,'The vowels are A, E, I, O, U.',2),
 ('fill_blank','Complete the sequence: P, Q, ___, S','Type one capital letter.','[]','[]','R',NULL,'After Q comes R.',3),
 ('match','Match each letter with a word that starts with it.',NULL,'[]','[{"left":"A","right":"Apple"},{"left":"B","right":"Ball"},{"left":"C","right":"Cat"},{"left":"D","right":"Dog"}]',NULL,NULL,NULL,4),
 ('audio','Listen and type the letter you hear.','Tap the speaker, then type the letter.','[]','[]','G','G','It was the letter G.',5)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Fruits & Vegetables
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Fruits & Vegetables')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','Which one is a fruit?',NULL,'["Potato","Mango","Onion","Carrot"]','[]','Mango',NULL,'Mango is a fruit; the others are vegetables.',1),
 ('mcq','"केळं" in English is:',NULL,'["Banana","Guava","Grapes","Papaya"]','[]','Banana',NULL,'केळं = Banana.',2),
 ('fill_blank','A red fruit that keeps the doctor away: ___','One word.','[]','[]','Apple',NULL,'An apple a day keeps the doctor away.',3),
 ('match','Match the English name with its Marathi name.',NULL,'[]','[{"left":"Grapes","right":"द्राक्षे"},{"left":"Onion","right":"कांदा"},{"left":"Tomato","right":"टोमॅटो"},{"left":"Spinach","right":"पालक"}]',NULL,NULL,NULL,4),
 ('audio','Listen and type the fruit name.',NULL,'[]','[]','Orange','Orange','The word was "Orange".',5)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Animals & Birds
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Animals & Birds')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','Which animal is called the king of the jungle?',NULL,'["Tiger","Lion","Elephant","Bear"]','[]','Lion',NULL,'The lion is called the king of the jungle.',1),
 ('mcq','Which one is a bird?',NULL,'["Cow","Goat","Parrot","Horse"]','[]','Parrot',NULL,'A parrot is a bird.',2),
 ('fill_blank','A dog says "bark", a cat says ___','One word.','[]','[]','Meow',NULL,'Cats meow.',3),
 ('match','Match the animal with its home.',NULL,'[]','[{"left":"Bird","right":"Nest"},{"left":"Bee","right":"Hive"},{"left":"Horse","right":"Stable"},{"left":"Lion","right":"Den"}]',NULL,NULL,NULL,4),
 ('audio','Listen and type the animal name.',NULL,'[]','[]','Elephant','Elephant','The word was "Elephant".',5)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Greetings
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Greetings & Politeness')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','You meet your teacher at 9 in the morning. You say:',NULL,'["Good night","Good morning","Good bye","Good luck"]','[]','Good morning',NULL,'Before noon we say "Good morning".',1),
 ('mcq','Someone helps you. The best reply is:',NULL,'["Sorry","Please","Thank you","Excuse me"]','[]','Thank you',NULL,'We thank people who help us.',2),
 ('fill_blank','"How are you?" — "I am ___, thank you."','One word.','[]','[]','fine',NULL,'"I am fine, thank you." is the standard reply.',3),
 ('match','Match the situation with the polite phrase.',NULL,'[]','[{"left":"You made a mistake","right":"I am sorry"},{"left":"You want to pass by","right":"Excuse me"},{"left":"You are leaving","right":"Goodbye"},{"left":"You are asking for help","right":"Please"}]',NULL,NULL,NULL,4),
 ('speak','Say aloud: "Good morning, how are you today?"','Tap the mic and speak clearly.','[]','[]','Good morning how are you today',NULL,'Speak slowly and clearly; every word matters.',5)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Sentence Formation
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Sentence Formation')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','Which sentence is correct?',NULL,'["I am go to school","I goes to school","I go to school","Me go to school"]','[]','I go to school',NULL,'With "I" we use the plain verb: I go.',1),
 ('mcq','Pick the correct order.',NULL,'["Cricket plays Rahul","Rahul plays cricket","Plays Rahul cricket","Cricket Rahul plays"]','[]','Rahul plays cricket',NULL,'English order is Subject + Verb + Object.',2),
 ('fill_blank','She ___ a doctor.','Use the correct form of "be".','[]','[]','is',NULL,'She / he / it takes "is".',3),
 ('match','Match the subject with the correct verb.',NULL,'[]','[{"left":"I","right":"am"},{"left":"He","right":"is"},{"left":"They","right":"are"},{"left":"We","right":"are"}]',NULL,NULL,NULL,4),
 ('speak','Say aloud: "My name is Mayur and I study in school."',NULL,'[]','[]','My name is Mayur and I study in school',NULL,'Introduce yourself with a full sentence.',5)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Articles & Prepositions
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Articles & Prepositions')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','I saw ___ elephant at the zoo.',NULL,'["a","an","the","no article"]','[]','an',NULL,'Use "an" before a vowel sound.',1),
 ('mcq','The book is ___ the table.',NULL,'["in","on","at","under"]','[]','on',NULL,'Something resting on a surface is "on".',2),
 ('fill_blank','We meet ___ 5 o''clock.','One word.','[]','[]','at',NULL,'We use "at" with clock time.',3),
 ('match','Match the preposition with its use.',NULL,'[]','[{"left":"in","right":"in April"},{"left":"on","right":"on Monday"},{"left":"at","right":"at 6 pm"},{"left":"under","right":"under the chair"}]',NULL,NULL,NULL,4)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Tenses
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Present, Past & Future')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','Yesterday I ___ to the market.',NULL,'["go","went","will go","going"]','[]','went',NULL,'"Yesterday" needs the past tense: went.',1),
 ('mcq','Tomorrow she ___ her friend.',NULL,'["met","meets","will meet","meeting"]','[]','will meet',NULL,'Future tense uses "will + verb".',2),
 ('fill_blank','He ___ (read) a book right now.','Use the -ing form with "is".','[]','[]','is reading',NULL,'Present continuous: is + reading.',3),
 ('match','Match the sentence with its tense.',NULL,'[]','[{"left":"I eat rice","right":"Present"},{"left":"I ate rice","right":"Past"},{"left":"I will eat rice","right":"Future"},{"left":"I am eating rice","right":"Present continuous"}]',NULL,NULL,NULL,4),
 ('audio','Listen and type the sentence.',NULL,'[]','[]','I will call you tomorrow','I will call you tomorrow','Future tense with "will".',5)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Talking with Friends
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Talking with Friends')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','Your friend says "What''s up?" A natural reply is:',NULL,'["I am fine, nothing much","Yes please","Sorry, no","Good night"]','[]','I am fine, nothing much',NULL,'"What''s up?" is casual for "how are things?".',1),
 ('mcq','You want to invite a friend. You say:',NULL,'["You come now","Do you want to join me?","Come here fast","I want you come"]','[]','Do you want to join me?',NULL,'Invitations use a polite question form.',2),
 ('fill_blank','"Let''s ___ a movie this evening."','One word.','[]','[]','watch',NULL,'After "let''s" we use the plain verb.',3),
 ('speak','Say aloud: "Hey, how was your day? Mine was great."',NULL,'[]','[]','Hey how was your day mine was great',NULL,'Friendly small talk keeps a conversation going.',4)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: At School
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'At School & with Teachers')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','You did not understand the lesson. You say:',NULL,'["Teach again","Could you please explain it again?","I don''t know anything","Repeat fast"]','[]','Could you please explain it again?',NULL,'Requests to a teacher stay polite.',1),
 ('mcq','You need to leave the classroom. You say:',NULL,'["I go out","May I go out, please?","Going out","Open the door"]','[]','May I go out, please?',NULL,'"May I..." asks for permission.',2),
 ('fill_blank','"I am ___ for being late, sir."','One word.','[]','[]','sorry',NULL,'Apologise with "I am sorry".',3),
 ('speak','Say aloud: "Good morning sir, may I come in?"',NULL,'[]','[]','Good morning sir may I come in',NULL,'Classic classroom request.',4)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: At the Market
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'At the Market')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','You want to know the price. You ask:',NULL,'["How much is this?","What money?","Give price","How many rupees you?"]','[]','How much is this?',NULL,'"How much is this?" is the standard question.',1),
 ('mcq','The price is too high. You politely say:',NULL,'["Too costly, cut it","Can you give me a small discount?","No money","Give free"]','[]','Can you give me a small discount?',NULL,'Bargain politely.',2),
 ('fill_blank','"I would like one ___ of tomatoes."','One word (weight).','[]','[]','kilo',NULL,'We buy vegetables by the kilo.',3),
 ('match','Match the shop with what you buy there.',NULL,'[]','[{"left":"Bakery","right":"Bread"},{"left":"Chemist","right":"Medicine"},{"left":"Stationery","right":"Notebook"},{"left":"Dairy","right":"Milk"}]',NULL,NULL,NULL,4)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Asking Questions
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Asking Questions')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','___ do you live?',NULL,'["What","Where","When","Who"]','[]','Where',NULL,'"Where" asks about a place.',1),
 ('mcq','___ is your birthday?',NULL,'["When","Why","Which","How"]','[]','When',NULL,'"When" asks about time.',2),
 ('fill_blank','___ are you learning English? — Because I want a good job.','One word.','[]','[]','Why',NULL,'"Why" asks for a reason.',3),
 ('match','Match the question word with what it asks.',NULL,'[]','[{"left":"Who","right":"Person"},{"left":"What","right":"Thing"},{"left":"Where","right":"Place"},{"left":"How","right":"Manner"}]',NULL,NULL,NULL,4)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Corporate Vocabulary
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Corporate Vocabulary')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','A "deadline" is:',NULL,'["A dead line on paper","The last date to finish work","A type of meeting","A salary slip"]','[]','The last date to finish work',NULL,'A deadline is the final date for a task.',1),
 ('mcq','"Please find the report attached" appears in:',NULL,'["A phone call","An email","A poster","A receipt"]','[]','An email',NULL,'It is standard email language.',2),
 ('fill_blank','Let''s schedule a ___ to discuss the project.','One word.','[]','[]','meeting',NULL,'We schedule meetings.',3),
 ('match','Match the office word with its meaning.',NULL,'[]','[{"left":"Agenda","right":"List of meeting topics"},{"left":"Minutes","right":"Written record of a meeting"},{"left":"Appraisal","right":"Performance review"},{"left":"Client","right":"Customer of the company"}]',NULL,NULL,NULL,4)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Email Drafting
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Email Drafting')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','Best subject line for a leave request:',NULL,'["Hi","Leave Application – 12 May","Important!!!","Please read"]','[]','Leave Application – 12 May',NULL,'A subject line should be short and specific.',1),
 ('mcq','You do not know the reader''s name. You begin with:',NULL,'["Hey","Dear Sir/Madam","Hello friend","To whom"]','[]','Dear Sir/Madam',NULL,'Use "Dear Sir/Madam" when the name is unknown.',2),
 ('fill_blank','Professional closing before your name: "___ regards,"','One word.','[]','[]','Best',NULL,'"Best regards," is a safe professional closing.',3),
 ('match','Match the email part with its purpose.',NULL,'[]','[{"left":"Subject","right":"Tells the topic"},{"left":"Salutation","right":"Greets the reader"},{"left":"Body","right":"Gives the details"},{"left":"Signature","right":"Shows who wrote it"}]',NULL,NULL,NULL,4)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Presentations
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Presentations')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','Best way to open a presentation:',NULL,'["Ok start","Good morning everyone, today I will talk about...","Listen to me","So yeah"]','[]','Good morning everyone, today I will talk about...',NULL,'Greet, then state your topic.',1),
 ('mcq','To move to the next point you say:',NULL,'["Next next","Let''s move on to...","After that thing","Now other"]','[]','Let''s move on to...',NULL,'Signposting keeps the audience with you.',2),
 ('fill_blank','"Thank you for your attention. Any ___?"','One word.','[]','[]','questions',NULL,'Invite questions at the end.',3),
 ('speak','Say aloud: "Good morning everyone, today I will present our monthly report."',NULL,'[]','[]','Good morning everyone today I will present our monthly report',NULL,'Practise a confident, clear opening.',4)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);

-- EXERCISES: Interview Preparation
WITH ls AS (SELECT id FROM public.english_lessons WHERE title = 'Interview Preparation')
INSERT INTO public.english_exercises (lesson_id, kind, prompt, helper_text, options, pairs, correct_answer, audio_text, explanation, position)
SELECT ls.id, x.kind::public.english_exercise_kind, x.prompt, x.helper, x.options::jsonb, x.pairs::jsonb, x.answer, x.audio, x.expl, x.pos FROM ls, (VALUES
 ('mcq','"Tell me about yourself" should be answered with:',NULL,'["Your full family history","A short summary of your studies, skills and goals","Your salary expectation","Nothing"]','[]','A short summary of your studies, skills and goals',NULL,'Keep it to 60–90 seconds and job-related.',1),
 ('mcq','Best answer to "What is your weakness?"',NULL,'["I have no weakness","I sometimes take extra time to check details, and I am improving my speed","I am lazy","I cannot say"]','[]','I sometimes take extra time to check details, and I am improving my speed',NULL,'Name a real weakness plus the action you take.',2),
 ('fill_blank','"Thank you for the ___" — the word for a job meeting.','One word.','[]','[]','opportunity',NULL,'"Thank you for the opportunity" is a strong closing line.',3),
 ('speak','Say aloud: "I am a hard-working student and I am eager to learn new skills."',NULL,'[]','[]','I am a hard working student and I am eager to learn new skills',NULL,'Speak with confidence and a steady pace.',4)
) AS x(kind, prompt, helper, options, pairs, answer, audio, expl, pos);
