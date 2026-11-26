// Disposable local database only; no hosted connection or customer data.
import assert from 'node:assert/strict'
import { checkAndClean, finishBatch, localPsql } from './local-psql-check.mjs'
const psql = localPsql(process.env.DB_URL, 'ai-quota')
const query = (sql, phase = 'check') => psql(phase, '-c', sql)
await checkAndClean(async () => {
  await psql('setup', '-f', 'experiments/supabase-auth/ai-quota-review.sql')
  const results = await finishBatch(Array.from({ length: 24 }, () => query('SELECT public.architekt_ai_reserve()', 'reservations')))
  assert.equal(results.filter((r) => r.stdout.trim() === 't').length, 10)
  assert.equal(results.filter((r) => r.stdout.trim() === 'f').length, 14)
  assert.equal((await query('SELECT used FROM public.architekt_ai_quota')).stdout.trim(), '10')
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(query(`SET ROLE ${role}; SELECT public.architekt_ai_reserve()`, 'role-check'), { sqlState: '42501' })
    await assert.rejects(query(`SET ROLE ${role}; SELECT * FROM public.architekt_ai_quota`, 'role-check'), { sqlState: '42501' })
  }
}, () => query('DROP FUNCTION IF EXISTS public.architekt_ai_reserve(); DROP TABLE IF EXISTS public.architekt_ai_quota', 'cleanup'))
console.log('PASS: AI quota admits exactly 10 of 24 concurrent calls and denies direct access to unprivileged roles')
