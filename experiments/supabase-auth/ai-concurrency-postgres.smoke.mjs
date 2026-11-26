// Disposable local database only. No network provider or customer data.
import assert from 'node:assert/strict'
import { checkAndClean, finishBatch, localPsql } from './local-psql-check.mjs'
const psql = localPsql(process.env.DB_URL, 'ai-concurrency')
const query = (sql, phase = 'check') => psql(phase, '-c', sql)
const acquire = async (phase = 'acquire') => JSON.parse((await query('SELECT public.architekt_ai_acquire()', phase)).stdout.trim())
const release = async (id) => (await query(`SELECT public.architekt_ai_release('${id}'::uuid)`)).stdout.trim()
await checkAndClean(async () => {
  await psql('setup', '-f', 'experiments/supabase-auth/ai-concurrency-review.sql')
  const results = await finishBatch(Array.from({ length: 24 }, () => acquire('reservations')))
  const held = results.filter((x) => x.status === 'ACQUIRED')
  assert.equal(held.length, 1)
  assert.equal(results.filter((x) => x.status === 'BUSY').length, 23)
  assert.equal((await query('SELECT used FROM public.architekt_ai_admission')).stdout.trim(), '1')
  assert.equal(await release('00000000-0000-4000-8000-000000000001'), 'f')
  assert.equal((await acquire()).status, 'BUSY')
  assert.equal(await release(held[0].lease_id), 't')
  assert.equal(await release(held[0].lease_id), 'f')
  const second = await acquire()
  assert.equal(second.status, 'ACQUIRED')
  await query("UPDATE public.architekt_ai_admission SET lease_expires_at = clock_timestamp() - interval '1 second'")
  const replacement = await acquire()
  assert.equal(replacement.status, 'ACQUIRED')
  assert.equal(await release(second.lease_id), 'f')
  assert.equal((await acquire()).status, 'BUSY')
  assert.equal(await release(replacement.lease_id), 't')
  for (let i = 3; i < 10; i++) {
    const result = await acquire()
    assert.equal(result.status, 'ACQUIRED')
    assert.equal(await release(result.lease_id), 't')
  }
  assert.equal((await acquire()).status, 'LIMIT_REACHED')
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(query(`SET ROLE ${role}; SELECT public.architekt_ai_acquire()`, 'role-check'), { sqlState: '42501' })
    await assert.rejects(query(`SET ROLE ${role}; SELECT public.architekt_ai_release('${replacement.lease_id}'::uuid)`, 'role-check'), { sqlState: '42501' })
    await assert.rejects(query(`SET ROLE ${role}; SELECT * FROM public.architekt_ai_admission`, 'role-check'), { sqlState: '42501' })
  }
}, () => query('DROP FUNCTION IF EXISTS public.architekt_ai_acquire(); DROP FUNCTION IF EXISTS public.architekt_ai_release(uuid); DROP TABLE IF EXISTS public.architekt_ai_admission', 'cleanup'))
console.log('PASS: atomic single-flight, stale-token safety, daily quota, role restrictions and fixture cleanup')
