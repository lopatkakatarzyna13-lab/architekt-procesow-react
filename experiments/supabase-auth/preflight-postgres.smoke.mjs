// Disposable local PostgreSQL only; never connect to the hosted database.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
const db = process.env.DB_URL
const url = db && new URL(db)
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.search) throw Error('LOCAL_DATABASE_REQUIRED')
const exec = promisify(execFile)
const psql = (...args) => exec('psql', [db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', ...args], { timeout: 30000 })
const query = (sql) => psql('-c', sql)
const path = 'experiments/supabase-auth/migration-draft/00-read-only-preflight.sql'
const read = async () => JSON.parse((await psql('-f', path)).stdout.trim())
const temp = await mkdtemp(join(tmpdir(), 'architekt-preflight-'))
let createdView = false, createdFunction = false, createdRole = false, defaultGrant = false
try {
  assert.equal((await query("SELECT to_regclass('public.architekt_ai_admission') IS NULL AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('architekt_ai_acquire','architekt_ai_release'))")).stdout.trim(), 't', 'Fixture requires unused target names')
  const before = await read()
  assert.equal(before.read_only_transaction, true)
  assert.deepEqual(before.required_roles_present, { anon: true, authenticated: true, service_role: true })
  assert.deepEqual(before.collision_counts, { relations: 0, types: 0, routines: 0 })
  assert.equal(before.service_role_can_use_public, true)
  const roleAbsent = await query("SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='architekt_preflight_fixture_role')")
  assert.equal(roleAbsent.stdout.trim(), 't')
  await query('CREATE ROLE architekt_preflight_fixture_role')
  createdRole = true
  await query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO architekt_preflight_fixture_role')
  defaultGrant = true
  const changedDefaults = await read()
  assert.ok(changedDefaults.unexpected_default_acl_entries > before.unexpected_default_acl_entries)
  await query('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM architekt_preflight_fixture_role')
  defaultGrant = false
  await query('CREATE VIEW public.architekt_ai_admission AS SELECT 42 AS sentinel')
  createdView = true
  await query('CREATE FUNCTION public.architekt_ai_acquire(integer) RETURNS integer LANGUAGE sql AS $$ SELECT $1 $$')
  createdFunction = true
  const collision = await read()
  assert.equal(collision.collision_counts.relations, 1)
  assert.ok(collision.collision_counts.types >= 1)
  assert.equal(collision.collision_counts.routines, 1)
  assert.equal((await query('SELECT sentinel FROM public.architekt_ai_admission')).stdout.trim(), '42')
  const source = await readFile(path, 'utf8')
  const forcedWrite = source.replace('COMMIT;', 'CREATE TABLE public.architekt_forbidden_write (id integer);\nCOMMIT;')
  assert.notEqual(source, forcedWrite)
  const bad = join(temp, 'write.sql')
  await writeFile(bad, forcedWrite)
  await assert.rejects(psql('-f', bad), 'read-only transaction must reject writes')
  assert.equal((await query("SELECT to_regclass('public.architekt_forbidden_write') IS NULL")).stdout.trim(), 't')
  assert.equal((await query('SELECT public.architekt_ai_acquire(42)')).stdout.trim(), '42')
  console.log('PASS: read-only inventory reports roles and collisions, preserves fixture data and rejects writes')
} finally {
  if (defaultGrant) await query('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM architekt_preflight_fixture_role').catch(() => {})
  if (createdRole) await query('DROP ROLE architekt_preflight_fixture_role').catch(() => {})
  if (createdFunction) await query('DROP FUNCTION public.architekt_ai_acquire(integer)').catch(() => {})
  if (createdView) await query('DROP VIEW public.architekt_ai_admission').catch(() => {})
  await rm(temp, { recursive: true, force: true })
}
