// Isolated concurrency experiment; never use this as the production quota.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const db = process.env.DB_URL
if (!db) throw new Error('Missing local DB_URL')
const url = new URL(db)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Refusing a non-local database')
const exec = promisify(execFile)
const query = (sql) => exec('psql', [db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql], { maxBuffer: 65536 })
try {
  await query('CREATE TABLE public.fixture_quota (id integer PRIMARY KEY, used integer NOT NULL); INSERT INTO public.fixture_quota VALUES (1, 0)')
  const requests = Array.from({ length: 24 }, () => query('UPDATE public.fixture_quota SET used = used + 1 WHERE id = 1 AND used < 12 RETURNING used'))
  const results = await Promise.all(requests)
  assert.equal(results.filter((r) => r.stdout.trim()).length, 12)
  const total = await query('SELECT used FROM public.fixture_quota WHERE id = 1')
  assert.equal(total.stdout.trim(), '12')
  console.log('PASS: 24 concurrent local database reservations admitted exactly 12')
} finally {
  await query('DROP TABLE IF EXISTS public.fixture_quota')
}
