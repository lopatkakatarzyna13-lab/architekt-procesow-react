-- Temporary CI database only. Never apply to a hosted or production project.
CREATE TABLE public.architekt_fixture_quota (id integer PRIMARY KEY CHECK (id = 1), used integer NOT NULL CHECK (used >= 0));
INSERT INTO public.architekt_fixture_quota VALUES (1, 0);
REVOKE ALL ON public.architekt_fixture_quota FROM PUBLIC, anon, authenticated;
ALTER TABLE public.architekt_fixture_quota ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.architekt_fixture_reserve() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE reserved integer;
BEGIN
  UPDATE public.architekt_fixture_quota SET used = used + 1 WHERE id = 1 AND used < 3 RETURNING used INTO reserved;
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.architekt_fixture_quota WHERE id = 1) THEN RAISE EXCEPTION 'quota missing'; END IF;
  RETURN reserved IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.architekt_fixture_reserve() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.architekt_fixture_reserve() TO service_role;
