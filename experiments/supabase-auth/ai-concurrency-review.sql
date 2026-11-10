-- EXPERIMENTAL REVIEW ONLY. Never apply to a hosted database without approval.
-- Atomic global single-flight admission plus ten UTC-day attempts.
CREATE TABLE public.architekt_ai_admission (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  day date NOT NULL,
  used integer NOT NULL CHECK (used BETWEEN 0 AND 10),
  lease_id uuid,
  lease_expires_at timestamptz,
  CHECK ((lease_id IS NULL) = (lease_expires_at IS NULL))
);
ALTER TABLE public.architekt_ai_admission ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.architekt_ai_admission FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.architekt_ai_acquire() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE state public.architekt_ai_admission%ROWTYPE;
DECLARE today date := (clock_timestamp() AT TIME ZONE 'UTC')::date;
DECLARE token uuid;
BEGIN
  INSERT INTO public.architekt_ai_admission (id, day, used) VALUES (true, today, 0) ON CONFLICT (id) DO NOTHING;
  SELECT * INTO state FROM public.architekt_ai_admission WHERE id = true FOR UPDATE;
  IF state.lease_id IS NOT NULL AND state.lease_expires_at > clock_timestamp() THEN
    RETURN jsonb_build_object('status', 'BUSY');
  END IF;
  IF state.day <> today THEN state.used := 0; END IF;
  IF state.used >= 10 THEN RETURN jsonb_build_object('status', 'LIMIT_REACHED'); END IF;
  token := gen_random_uuid();
  UPDATE public.architekt_ai_admission SET day = today, used = state.used + 1,
    lease_id = token, lease_expires_at = clock_timestamp() + interval '5 minutes' WHERE id = true;
  RETURN jsonb_build_object('status', 'ACQUIRED', 'lease_id', token);
END;
$$;
CREATE FUNCTION public.architekt_ai_release(p_lease_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE released boolean;
BEGIN
  UPDATE public.architekt_ai_admission SET lease_id = NULL, lease_expires_at = NULL
    WHERE id = true AND lease_id = p_lease_id RETURNING true INTO released;
  RETURN coalesce(released, false);
END;
$$;
REVOKE ALL ON FUNCTION public.architekt_ai_acquire() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.architekt_ai_release(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.architekt_ai_acquire() TO service_role;
GRANT EXECUTE ON FUNCTION public.architekt_ai_release(uuid) TO service_role;
