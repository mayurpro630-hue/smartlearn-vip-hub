REVOKE ALL ON FUNCTION public.evaluate_vip_tier(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flag_practice_attempt() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_attempt_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_vip_tier(uuid) TO service_role;
