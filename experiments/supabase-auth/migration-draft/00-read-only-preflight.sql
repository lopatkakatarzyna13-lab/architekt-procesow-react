-- INVENTORY FOR REVIEW ONLY. Do not use results as permission to deploy.
-- Returns only role flags and object counts, not row data, keys or function bodies.
-- Run separately against the intended project after confirming its identity.
BEGIN TRANSACTION READ ONLY;
WITH role_info AS (
  SELECT rolname, oid, rolsuper, rolbypassrls FROM pg_catalog.pg_roles
  WHERE rolname IN ('anon', 'authenticated', 'service_role', current_user)
), collisions AS (
  SELECT
    (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='architekt_ai_admission') AS relations,
    (SELECT count(*) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' AND t.typname='architekt_ai_admission') AS types,
    (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('architekt_ai_acquire','architekt_ai_release')) AS routines
), defaults AS (
  SELECT count(*) AS unexpected_grants
  FROM pg_catalog.pg_default_acl d
  JOIN role_info executor ON executor.rolname=current_user AND executor.oid=d.defaclrole
  LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
  WHERE d.defaclobjtype IN ('r','f') AND (d.defaclnamespace=0 OR n.nspname='public')
    AND a.grantee NOT IN (executor.oid, COALESCE((SELECT oid FROM role_info WHERE rolname='service_role'), 0::oid))
    AND a.grantee <> 0
    -- Explicit app-role grants are removed by the migration, but indirect grants still need review.
    AND a.grantee NOT IN (COALESCE((SELECT oid FROM role_info WHERE rolname='anon'), 0::oid),
                          COALESCE((SELECT oid FROM role_info WHERE rolname='authenticated'), 0::oid))
)
SELECT pg_catalog.jsonb_build_object(
  'read_only_transaction', pg_catalog.current_setting('transaction_read_only')='on',
  'required_roles_present', pg_catalog.jsonb_build_object(
    'anon', EXISTS(SELECT 1 FROM role_info WHERE rolname='anon'),
    'authenticated', EXISTS(SELECT 1 FROM role_info WHERE rolname='authenticated'),
    'service_role', EXISTS(SELECT 1 FROM role_info WHERE rolname='service_role')),
  'collision_counts', pg_catalog.to_jsonb(collisions),
  'executor_can_create_in_public', pg_catalog.has_schema_privilege(current_user,'public','CREATE'),
  'service_role_can_use_public', CASE WHEN EXISTS(SELECT 1 FROM role_info WHERE rolname='service_role')
    THEN pg_catalog.has_schema_privilege('service_role','public','USAGE') ELSE NULL END,
  'executor_is_superuser', (SELECT rolsuper FROM role_info WHERE rolname=current_user),
  'executor_bypasses_rls', (SELECT rolbypassrls FROM role_info WHERE rolname=current_user),
  'service_role_is_superuser', (SELECT rolsuper FROM role_info WHERE rolname='service_role'),
  'service_role_bypasses_rls', (SELECT rolbypassrls FROM role_info WHERE rolname='service_role'),
  'service_role_member_of_executor', CASE WHEN EXISTS(SELECT 1 FROM role_info WHERE rolname='service_role')
    THEN pg_catalog.pg_has_role('service_role',current_user,'MEMBER') ELSE NULL END,
  'unexpected_default_acl_entries', defaults.unexpected_grants,
  'migration_history_relation_present', pg_catalog.to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
  'uuid_function_available', pg_catalog.to_regprocedure('pg_catalog.gen_random_uuid()') IS NOT NULL
) FROM collisions, defaults;
COMMIT;
