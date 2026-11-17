-- REVIEW ONLY. Do not run on a hosted database without explicit approval.
-- Disable NEW admissions only. Preserve table, usage count and active leases.
-- In-flight provider work may continue; release remains available.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.architekt_ai_acquire() FROM PUBLIC, anon, authenticated, service_role;
DO $$
BEGIN
  IF pg_catalog.has_function_privilege('service_role', 'public.architekt_ai_acquire()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role still has execute through another grant or role';
  END IF;
END;
$$;
COMMIT;
