ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS is_practice boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_tier text NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS public.vip_tiers (
  tier text PRIMARY KEY,
  label text NOT NULL,
  min_score integer NOT NULL DEFAULT 0,
  min_tests integer NOT NULL DEFAULT 0,
  max_flags integer NOT NULL DEFAULT 999,
  rank integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vip_tiers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vip_tiers TO authenticated;
GRANT ALL ON public.vip_tiers TO service_role;

ALTER TABLE public.vip_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vip tiers public read" ON public.vip_tiers FOR SELECT USING (true);
CREATE POLICY "admin manage vip tiers" ON public.vip_tiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $fn$;

CREATE TRIGGER update_vip_tiers_updated_at BEFORE UPDATE ON public.vip_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.vip_tiers (tier, label, min_score, min_tests, max_flags, rank, enabled) VALUES
  ('silver',  'Silver VIP',  20, 2, 5, 1, true),
  ('golden',  'Golden VIP',  50, 5, 2, 2, true),
  ('diamond', 'Diamond VIP', 100, 10, 0, 3, true)
ON CONFLICT (tier) DO NOTHING;

CREATE OR REPLACE FUNCTION public.flag_practice_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.test_attempts
    WHERE user_id = NEW.user_id AND test_id = NEW.test_id AND is_practice = false
  ) THEN
    NEW.is_practice := true;
  ELSE
    NEW.is_practice := false;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS before_attempt_created ON public.test_attempts;
CREATE TRIGGER before_attempt_created BEFORE INSERT ON public.test_attempts
  FOR EACH ROW EXECUTE FUNCTION public.flag_practice_attempt();

CREATE OR REPLACE FUNCTION public.evaluate_vip_tier(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_score integer;
  v_tests integer;
  v_flags integer;
  v_tier text;
BEGIN
  SELECT COALESCE(sum(score), 0), count(*), COALESCE(sum(tab_switch_count), 0)
    INTO v_score, v_tests, v_flags
  FROM public.test_attempts
  WHERE user_id = _user_id AND is_practice = false;

  SELECT t.tier INTO v_tier
  FROM public.vip_tiers t
  WHERE t.enabled
    AND v_score >= t.min_score
    AND v_tests >= t.min_tests
    AND v_flags <= t.max_flags
  ORDER BY t.rank DESC
  LIMIT 1;

  UPDATE public.profiles
     SET vip_tier = COALESCE(v_tier, 'none'),
         is_vip = v_tier IS NOT NULL,
         vip_since = CASE WHEN v_tier IS NOT NULL AND vip_since IS NULL THEN now()
                          WHEN v_tier IS NOT NULL THEN vip_since ELSE NULL END
   WHERE id = _user_id;
END; $$;

REVOKE ALL ON FUNCTION public.evaluate_vip_tier(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_vip_tier(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_attempt_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent_count integer;
BEGIN
  IF NEW.is_practice THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count FROM public.test_attempts
   WHERE user_id = NEW.user_id AND is_practice = false AND created_at > now() - interval '24 hours';

  UPDATE public.profiles SET
    total_score = total_score + NEW.score,
    tests_taken = tests_taken + 1,
    streak = recent_count
  WHERE id = NEW.user_id;

  PERFORM public.evaluate_vip_tier(NEW.user_id);
  RETURN NEW;
END; $$;
