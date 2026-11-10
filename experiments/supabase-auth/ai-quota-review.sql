-- REVIEW ONLY. Do not apply without explicit approval and a migration review.
-- Every admitted request consumes one slot, including provider errors/timeouts.
CREATE TABLE public.architekt_ai_quota (day date PRIMARY KEY, used integer NOT NULL CHECK (used >= 0 AND used <= 10));
ALTER TABLE public.architekt_ai_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.architekt_ai_quota FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.architekt_ai_reserve() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE reserved integer;
BEGIN
  INSERT INTO public.architekt_ai_quota AS q (day, used)
  VALUES ((now() AT TIME ZONE 'UTC')::date, 1)
  ON CONFLICT (day) DO UPDATE SET used = q.used + 1 WHERE q.used < 10
  RETURNING used INTO reserved;
  RETURN reserved IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.architekt_ai_reserve() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.architekt_ai_reserve() TO service_role;
