// Disposable local database only; no hosted connection or customer data.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const db = process.env.DB_URL
if (!db || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(db).hostname)) throw new Error('LOCAL_DATABASE_REQUIRED')
const exec = promisify(execFile)
const psql = (...args) => exec('psql', [db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', ...args], { maxBuffer: 65536 })
const query = (sql) => psql('-c', sql)
try {
  await psql('-f', 'experiments/supabase-auth/ai-quota-review.sql')
  const results = await Promise.all(Array.from({ length: 24 }, () => query('SELECT public.architekt_ai_reserve()')))
  assert.equal(results.filter((r) => r.stdout.trim() === 't').length, 10)
  assert.equal(results.filter((r) => r.stdout.trim() === 'f').length, 14)
  assert.equal((await query('SELECT used FROM public.architekt_ai_quota')).stdout.trim(), '10')
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(query(`SET ROLE ${role}; SELECT public.architekt_ai_reserve()`))
    await assert.rejects(query(`SET ROLE ${role}; SELECT * FROM public.architekt_ai_quota`))
  }
  console.log('PASS: AI quota admits exactly 10 of 24 concurrent calls and denies direct access to unprivileged roles')
} finally {
  await query('DROP FUNCTION IF EXISTS public.architekt_ai_reserve(); DROP TABLE IF EXISTS public.architekt_ai_quota').catch(() => {})
}
