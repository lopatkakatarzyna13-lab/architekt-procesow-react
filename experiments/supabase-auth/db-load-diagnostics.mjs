// Disposable CI database only. No data, application secrets or remote provider calls.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const db = process.env.DB_URL
if (!db || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(db).hostname)) throw Error('LOCAL_DATABASE_REQUIRED')
const phase = process.argv[2]
if (!['baseline', 'after-integration'].includes(phase)) throw Error('INVALID_PHASE')
const exec = promisify(execFile)
const dbContainer = 'supabase_db_architekt-supabase'
const sample = async () => {
  try {
    const state = (await exec('docker', ['inspect', '--format', '{{.State.Status}} {{.State.OOMKilled}} {{.RestartCount}}', dbContainer], { timeout: 5000 })).stdout.trim()
    const mem = (await exec('docker', ['stats', '--no-stream', '--format', '{{.MemUsage}}', dbContainer], { timeout: 10000 })).stdout.trim()
    const stateSafe = /^(running|restarting|exited|created|paused) (true|false) \d+$/.test(state) ? state : 'unavailable'
    const memSafe = /^\d+(\.\d+)?[KMG]iB\s*\/\s*\d+(\.\d+)?[KMG]iB$/.test(mem) ? mem : 'unavailable'
    return { state: stateSafe, memory: memSafe }
  } catch { return { state: 'unavailable', memory: 'unavailable' } }
}
const call = () => exec('psql', [db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT pg_sleep(0.25), 1'], { timeout: 15000, maxBuffer: 4096 })
console.log('DB_LOAD_START', JSON.stringify({ phase, sample: await sample() }))
for (const concurrency of [1, 4, 12, 24]) {
  for (let round = 1; round <= 3; round++) {
    const started = Date.now()
    const results = await Promise.allSettled(Array.from({ length: concurrency }, call))
    const failed = results.filter((x) => x.status === 'rejected').length
    const health = await call().then(() => 'ok', () => 'failed')
    console.log('DB_LOAD_RESULT', JSON.stringify({ phase, concurrency, round, succeeded: concurrency - failed, failed, health, elapsedMs: Date.now() - started, sample: await sample() }))
    assert.equal(failed, 0, `database connection failure at ${phase}/${concurrency}/${round}`)
    assert.equal(health, 'ok', `database health failure at ${phase}/${concurrency}/${round}`)
  }
}
console.log('PASS: bounded staged local database connection diagnostics', phase)
