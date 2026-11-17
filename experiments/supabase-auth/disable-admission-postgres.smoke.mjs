// Disposable local PostgreSQL only. No hosted database or real API calls.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const db = process.env.DB_URL
if (!db || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(db).hostname)) throw Error('LOCAL_DATABASE_REQUIRED')
const exec = promisify(execFile)
const psql = (...args) => exec('psql', [db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', ...args])
const query = (sql) => psql('-c', sql)
try {
  await psql('-f', 'experiments/supabase-auth/ai-concurrency-review.sql')
  const acquired = JSON.parse((await query('SET ROLE service_role; SELECT public.architekt_ai_acquire()')).stdout.trim())
  assert.equal(acquired.status, 'ACQUIRED')
  assert.equal((await query('SELECT used FROM public.architekt_ai_admission')).stdout.trim(), '1')
  await psql('-f', 'experiments/supabase-auth/ai-disable-admission-review.sql')
  assert.equal((await query("SELECT has_function_privilege('service_role', 'public.architekt_ai_acquire()', 'EXECUTE')")).stdout.trim(), 'f')
  await assert.rejects(query('SET ROLE service_role; SELECT public.architekt_ai_acquire()'))
  assert.equal((await query('SELECT used FROM public.architekt_ai_admission')).stdout.trim(), '1')
  assert.equal((await query(`SET ROLE service_role; SELECT public.architekt_ai_release('${acquired.lease_id}'::uuid)`)).stdout.trim(), 't')
  assert.equal((await query('SELECT used FROM public.architekt_ai_admission')).stdout.trim(), '1')
  assert.equal((await query('SELECT lease_id IS NULL FROM public.architekt_ai_admission')).stdout.trim(), 't')
  // An inherited grant must be detected instead of falsely claiming a shutdown.
  await query('CREATE ROLE architekt_fixture_inherited; GRANT EXECUTE ON FUNCTION public.architekt_ai_acquire() TO architekt_fixture_inherited; GRANT architekt_fixture_inherited TO service_role')
  await assert.rejects(psql('-f', 'experiments/supabase-auth/ai-disable-admission-review.sql'))
  assert.equal((await query("SELECT has_function_privilege('service_role', 'public.architekt_ai_acquire()', 'EXECUTE')")).stdout.trim(), 't')
  console.log('PASS: disabling new admission preserves attempt count and allows an existing lease to release')
  console.log('PASS: inherited permission is detected and cannot silently pass as disabled')
} finally {
  await query('DROP FUNCTION IF EXISTS public.architekt_ai_acquire(); DROP FUNCTION IF EXISTS public.architekt_ai_release(uuid); DROP TABLE IF EXISTS public.architekt_ai_admission; DROP ROLE IF EXISTS architekt_fixture_inherited')
}
