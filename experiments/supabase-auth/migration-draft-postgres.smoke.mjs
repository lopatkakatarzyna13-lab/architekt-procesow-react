// Disposable local PostgreSQL only; never use a hosted database or customer data.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
const db = process.env.DB_URL
if (!db || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(db).hostname)) throw Error('LOCAL_DATABASE_REQUIRED')
const exec = promisify(execFile)
const psql = (...args) => exec('psql', [db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', ...args], { timeout: 30000 })
const query = (sql) => psql('-c', sql)
const draft = 'experiments/supabase-auth/migration-draft/001-ai-admission.sql'
const source = await readFile(draft, 'utf8')
assert.ok(source.endsWith('COMMIT;\n'))
const folder = await mkdtemp(join(tmpdir(), 'architekt-migration-'))
const broken = join(folder, 'interrupted.sql')
await writeFile(broken, source.replace(/COMMIT;\s*$/, 'SELECT 1 / 0;\nCOMMIT;\n'))
const absent = async () => (await query("SELECT to_regclass('public.architekt_ai_admission') IS NULL AND to_regprocedure('public.architekt_ai_acquire()') IS NULL AND to_regprocedure('public.architekt_ai_release(uuid)') IS NULL")).stdout.trim() === 't'
let ownObjects = false
try {
  // Refuse to touch any pre-existing similarly named object in the fixture database.
  const clean = await query("SELECT NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('architekt_ai_admission','architekt_fixture_existing_data')) AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('architekt_ai_acquire','architekt_ai_release')) AND NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='architekt_ai_admission')")
  assert.equal(clean.stdout.trim(), 't', 'Fixture must start without colliding names')
  ownObjects = true
  await query("CREATE TABLE public.architekt_fixture_existing_data (value text); INSERT INTO public.architekt_fixture_existing_data VALUES ('fictional-existing-data')")
  // A failure after CREATE/GRANT must leave no partial objects.
  await assert.rejects(psql('-f', broken))
  assert.equal(await absent(), true, 'transaction must roll back all created objects')
  assert.equal((await query('SELECT value FROM public.architekt_fixture_existing_data')).stdout.trim(), 'fictional-existing-data')
  // Collision with a relation or overloaded RPC must abort without changing it.
  await query('CREATE VIEW public.architekt_ai_admission AS SELECT 42 AS sentinel')
  await assert.rejects(psql('-f', draft))
  assert.equal((await query('SELECT sentinel FROM public.architekt_ai_admission')).stdout.trim(), '42')
  await query('DROP VIEW public.architekt_ai_admission; CREATE FUNCTION public.architekt_ai_acquire(integer) RETURNS integer LANGUAGE sql AS $$ SELECT $1 $$')
  await assert.rejects(psql('-f', draft))
  assert.equal((await query('SELECT public.architekt_ai_acquire(42)')).stdout.trim(), '42')
  await query('DROP FUNCTION public.architekt_ai_acquire(integer)')
  await psql('-f', draft)
  const acquired = JSON.parse((await query('SET ROLE service_role; SELECT public.architekt_ai_acquire()')).stdout.trim())
  assert.equal(acquired.status, 'ACQUIRED')
  await assert.rejects(query('SET ROLE authenticated; SELECT public.architekt_ai_acquire()'))
  await assert.rejects(query('SET ROLE anon; SELECT * FROM public.architekt_ai_admission'))
  await assert.rejects(psql('-f', draft), 'second application must refuse existing objects')
  assert.equal((await query('SELECT used FROM public.architekt_ai_admission')).stdout.trim(), '1')
  await psql('-f', 'experiments/supabase-auth/ai-disable-admission-review.sql')
  await assert.rejects(query('SET ROLE service_role; SELECT public.architekt_ai_acquire()'))
  assert.equal((await query(`SET ROLE service_role; SELECT public.architekt_ai_release('${acquired.lease_id}'::uuid)`)).stdout.trim(), 't')
  assert.equal((await query('SELECT used FROM public.architekt_ai_admission')).stdout.trim(), '1')
  assert.equal((await query('SELECT value FROM public.architekt_fixture_existing_data')).stdout.trim(), 'fictional-existing-data')
  console.log('PASS: migration draft is atomic, detects name collisions and repeat application, preserves unrelated data and allows safe admission shutdown')
} finally {
  if (ownObjects) await query('DROP FUNCTION IF EXISTS public.architekt_ai_acquire(); DROP FUNCTION IF EXISTS public.architekt_ai_release(uuid); DROP TABLE IF EXISTS public.architekt_ai_admission; DROP TABLE IF EXISTS public.architekt_fixture_existing_data').catch(() => {})
  await rm(folder, { recursive: true, force: true })
}
