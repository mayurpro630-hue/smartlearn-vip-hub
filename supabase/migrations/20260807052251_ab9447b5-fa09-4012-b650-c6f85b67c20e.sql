
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- PROFILES (public-safe)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  is_vip boolean NOT NULL DEFAULT false,
  streak integer NOT NULL DEFAULT 0,
  total_score integer NOT NULL DEFAULT 0,
  tests_taken integer NOT NULL DEFAULT 0,
  vip_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles are public" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.profile_contacts (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mobile text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profile_contacts TO authenticated;
GRANT ALL ON public.profile_contacts TO service_role;
ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin contact" ON public.profile_contacts FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile_contacts (id, mobile)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'mobile',''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CONTENT
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  title text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 10,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_option text NOT NULL,
  explanation text,
  hint text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subjects, public.chapters, public.tests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects, public.chapters, public.tests, public.questions TO authenticated;
GRANT ALL ON public.subjects, public.chapters, public.tests, public.questions TO service_role;

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subjects public read" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "chapters public read" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "tests public read" ON public.tests FOR SELECT USING (true);
CREATE POLICY "questions auth read" ON public.questions FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin manage subjects" ON public.subjects FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage chapters" ON public.chapters FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage tests" ON public.tests FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage questions" ON public.questions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ATTEMPTS
CREATE TABLE public.test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  tab_switch_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.test_attempts TO authenticated;
GRANT ALL ON public.test_attempts TO service_role;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own attempts" ON public.test_attempts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own attempts" ON public.test_attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option text,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.attempt_answers TO authenticated;
GRANT ALL ON public.attempt_answers TO service_role;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own answers" ON public.attempt_answers FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own answers" ON public.attempt_answers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own bookmarks" ON public.bookmarks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  message text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.error_reports TO authenticated;
GRANT UPDATE, DELETE ON public.error_reports TO authenticated;
GRANT ALL ON public.error_reports TO service_role;
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own reports" ON public.error_reports FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own reports" ON public.error_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin update reports" ON public.error_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- STREAK / VIP LOGIC
CREATE OR REPLACE FUNCTION public.apply_attempt_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count FROM public.test_attempts
   WHERE user_id = NEW.user_id AND created_at > now() - interval '24 hours';

  UPDATE public.profiles SET
    total_score = total_score + NEW.score,
    tests_taken = tests_taken + 1,
    streak = recent_count,
    is_vip = (recent_count >= 2),
    vip_since = CASE WHEN recent_count >= 2 AND vip_since IS NULL THEN now()
                     WHEN recent_count >= 2 THEN vip_since ELSE NULL END
  WHERE id = NEW.user_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_attempt_created AFTER INSERT ON public.test_attempts
FOR EACH ROW EXECUTE FUNCTION public.apply_attempt_stats();

-- DEMO CONTENT
INSERT INTO public.subjects (id, name, description, icon, position) VALUES
 ('11111111-1111-1111-1111-111111111111','Mathematics','Arithmetic, algebra and geometry practice','Sigma',1),
 ('22222222-2222-2222-2222-222222222222','Science','Physics, chemistry and biology basics','Atom',2),
 ('33333333-3333-3333-3333-333333333333','General Knowledge','Current affairs, history and geography','Globe',3);

INSERT INTO public.chapters (id, subject_id, name, description, position) VALUES
 ('a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Percentages','Core percentage calculations',1),
 ('a2222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Algebra Basics','Linear equations and expressions',2),
 ('b1111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Motion','Speed, velocity and acceleration',1),
 ('c1111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','Indian History','Ancient to modern India',1);

INSERT INTO public.tests (id, chapter_id, title, duration_minutes, position) VALUES
 ('d1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','Test 1',5,1),
 ('d2222222-2222-2222-2222-222222222222','a1111111-1111-1111-1111-111111111111','Test 2',5,2),
 ('d3333333-3333-3333-3333-333333333333','a2222222-2222-2222-2222-222222222222','Test 1',5,1),
 ('d4444444-4444-4444-4444-444444444444','b1111111-1111-1111-1111-111111111111','Test 1',5,1),
 ('d5555555-5555-5555-5555-555555555555','c1111111-1111-1111-1111-111111111111','Test 1',5,1);

INSERT INTO public.questions (test_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, hint, position) VALUES
 ('d1111111-1111-1111-1111-111111111111','What is 25% of 240?','50','60','70','80','B','25% means one quarter, so 240 / 4 = 60.','Divide by 4.',1),
 ('d1111111-1111-1111-1111-111111111111','If a price rises from 200 to 250, what is the percentage increase?','20%','25%','30%','50%','B','Increase = 50. 50/200 x 100 = 25%.','Compare the rise with the original price.',2),
 ('d1111111-1111-1111-1111-111111111111','40 is what percent of 160?','20%','25%','30%','40%','B','40/160 x 100 = 25%.','Form the fraction first.',3),
 ('d2222222-2222-2222-2222-222222222222','A number decreased by 20% becomes 96. Find the number.','110','115','120','125','C','0.8x = 96 so x = 120.','Think of 96 as 80% of the number.',1),
 ('d2222222-2222-2222-2222-222222222222','15% of 300 equals?','35','40','45','50','C','0.15 x 300 = 45.','10% is 30.',2),
 ('d3333333-3333-3333-3333-333333333333','Solve: 2x + 6 = 18','4','5','6','7','C','2x = 12 so x = 6.','Move 6 to the other side first.',1),
 ('d3333333-3333-3333-3333-333333333333','Simplify: 3(a + 2) - 2a','a + 6','a + 2','5a + 6','a - 6','A','3a + 6 - 2a = a + 6.','Expand the bracket.',2),
 ('d4444444-4444-4444-4444-444444444444','SI unit of speed is?','m/s','m/s^2','N','J','A','Speed = distance / time, so metres per second.','Distance over time.',1),
 ('d4444444-4444-4444-4444-444444444444','A car travels 150 km in 3 hours. Average speed?','40 km/h','45 km/h','50 km/h','60 km/h','C','150 / 3 = 50 km/h.','Divide distance by time.',2),
 ('d5555555-5555-5555-5555-555555555555','Who founded the Maurya Empire?','Ashoka','Chandragupta Maurya','Bindusara','Harsha','B','Chandragupta Maurya founded it in 322 BCE.','He was guided by Chanakya.',1),
 ('d5555555-5555-5555-5555-555555555555','The Quit India Movement began in which year?','1930','1942','1945','1947','B','It was launched in August 1942.','It followed the Cripps Mission.',2);
