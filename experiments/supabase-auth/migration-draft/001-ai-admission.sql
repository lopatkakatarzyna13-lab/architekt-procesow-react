-- DRAFT FOR ISOLATED REVIEW ONLY. Not an approved or deployable migration.
-- Never run on hosted Supabase without target-specific review and explicit approval.
-- Transaction requires a runner that stops on SQL errors (psql: ON_ERROR_STOP=1).
BEGIN;
DO $preflight$
DECLARE missing_role text;
BEGIN
  SELECT name INTO missing_role FROM unnest(ARRAY['anon','authenticated','service_role']) AS name
    WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = name) LIMIT 1;
  IF missing_role IS NOT NULL THEN RAISE EXCEPTION 'Required role missing: %', missing_role; END IF;
  IF NOT pg_catalog.has_schema_privilege(current_user, 'public', 'CREATE')
     OR NOT pg_catalog.has_schema_privilege('service_role', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'Required public schema permissions are missing';
  END IF;
  IF pg_catalog.to_regprocedure('pg_catalog.gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'Required pg_catalog.gen_random_uuid() is unavailable';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'architekt_ai_admission')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'architekt_ai_admission')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('architekt_ai_acquire','architekt_ai_release')) THEN
    RAISE EXCEPTION 'Object name collision; review existing objects before proceeding';
  END IF;
END;
$preflight$;
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
DECLARE today date;
DECLARE token uuid;
BEGIN
  INSERT INTO public.architekt_ai_admission (id, day, used)
    VALUES (true, (clock_timestamp() AT TIME ZONE 'UTC')::date, 0) ON CONFLICT (id) DO NOTHING;
  SELECT * INTO state FROM public.architekt_ai_admission WHERE id = true FOR UPDATE;
  -- Compute the quota day after any wait for the row lock, not before it.
  today := (clock_timestamp() AT TIME ZONE 'UTC')::date;
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

-- Reject unsafe effective grants, including those inherited through roles.
-- The owner must be reviewed on the actual target; elevated roles are not contained by RLS.
DO $verify$
DECLARE r text;
DECLARE privilege_name text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF pg_catalog.has_table_privilege(r, 'public.architekt_ai_admission', privilege_name) THEN
        RAISE EXCEPTION 'Unexpected effective table permission for %', r;
      END IF;
    END LOOP;
    IF pg_catalog.has_function_privilege(r, 'public.architekt_ai_acquire()', 'EXECUTE') OR
       pg_catalog.has_function_privilege(r, 'public.architekt_ai_release(uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected effective function permission for %', r;
    END IF;
  END LOOP;
  IF NOT pg_catalog.has_function_privilege('service_role', 'public.architekt_ai_acquire()', 'EXECUTE') OR
     NOT pg_catalog.has_function_privilege('service_role', 'public.architekt_ai_release(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Required service_role function permission is missing';
  END IF;
  -- Default grants to unexpected roles must be reviewed, not silently retained.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c,
      LATERAL pg_catalog.aclexplode(COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))) a
    WHERE c.oid = 'public.architekt_ai_admission'::regclass AND a.grantee <> c.relowner
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p,
      LATERAL pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    WHERE p.oid IN ('public.architekt_ai_acquire()'::regprocedure, 'public.architekt_ai_release(uuid)'::regprocedure)
      AND a.grantee <> p.proowner AND a.grantee <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'service_role')
  ) THEN RAISE EXCEPTION 'Unexpected object ACL; review role defaults'; END IF;
END;
$verify$;
COMMIT;
