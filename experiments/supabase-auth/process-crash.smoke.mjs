// Disposable local database and fictional provider only. No hosted services.
import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { once } from 'node:events'
import { promisify } from 'node:util'
import { createHandler } from '../../supabase/functions/workshop-ai/handler.js'

const db = process.env.DB_URL
if (!db || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(db).hostname)) throw Error('LOCAL_DATABASE_REQUIRED')
const exec = promisify(execFile)
const psql = (...args) => exec('psql', [db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', ...args])
const query = (sql) => psql('-c', sql)
const acquire = async () => JSON.parse((await query('SELECT public.architekt_ai_acquire()')).stdout.trim())
const release = async (id) => (await query(`SELECT public.architekt_ai_release('${id}'::uuid)`)).stdout.trim() === 't'

if (process.argv[2] === '--worker') {
  const handler = createHandler({
    enabled: true, origin: 'https://app.example.test', ownerId: 'fixture-owner',
    verify: async () => 'fixture-owner', reserve: acquire, release,
    analyze: async () => {
      process.send('provider-started')
      return new Promise(() => {}) // fictional provider deliberately remains in flight
    },
  })
  await handler(new Request('https://app.example.test', {
    method: 'POST', headers: { origin: 'https://app.example.test', authorization: 'Bearer fixture', 'content-type': 'application/json' },
    body: JSON.stringify({ transcript: 'Fikcyjny warsztat' }),
  }))
} else {
  let worker
  try {
    await psql('-f', 'experiments/supabase-auth/ai-concurrency-review.sql')
    worker = spawn(process.execPath, [import.meta.filename, '--worker'], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] })
    const started = Promise.race([
      once(worker, 'message').then(([message]) => { assert.equal(message, 'provider-started') }),
      once(worker, 'exit').then(() => { throw Error('WORKER_EXITED_BEFORE_PROVIDER') }),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('WORKER_START_TIMEOUT')), 15000); timer.unref() }),
    ])
    await started
    const before = JSON.parse((await query("SELECT json_build_object('id', lease_id, 'used', used) FROM public.architekt_ai_admission")).stdout.trim())
    assert.equal(before.used, 1)
    assert.equal((await acquire()).status, 'BUSY')
    const exited = once(worker, 'exit')
    assert.equal(worker.kill('SIGKILL'), true)
    const [, signal] = await exited
    assert.equal(signal, 'SIGKILL')
    assert.equal((await acquire()).status, 'BUSY')
    assert.equal((await query('SELECT used FROM public.architekt_ai_admission')).stdout.trim(), '1')
    // Simulate expiry instead of waiting five minutes; this is not a real-time expiry test.
    await query("UPDATE public.architekt_ai_admission SET lease_expires_at = clock_timestamp() - interval '1 second'")
    const replacement = await acquire()
    assert.equal(replacement.status, 'ACQUIRED')
    assert.equal((await query('SELECT used FROM public.architekt_ai_admission')).stdout.trim(), '2')
    assert.equal(await release(before.id), false)
    assert.equal((await acquire()).status, 'BUSY')
    assert.equal(await release(replacement.lease_id), true)
    console.log('PASS: killed analysis process leaves lease and attempt; simulated expiry allows a second counted attempt')
  } finally {
    if (worker && worker.exitCode === null && worker.signalCode === null) worker.kill('SIGKILL')
    await query('DROP FUNCTION IF EXISTS public.architekt_ai_acquire(); DROP FUNCTION IF EXISTS public.architekt_ai_release(uuid); DROP TABLE IF EXISTS public.architekt_ai_admission').catch(() => {})
  }
}
