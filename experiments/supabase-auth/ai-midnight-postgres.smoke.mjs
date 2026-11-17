// Isolated, disposable PostgreSQL only. The simulated clock never leaves this fixture.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const db = process.env.DB_URL
if (!db || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(db).hostname)) throw Error('LOCAL_DATABASE_REQUIRED')
const exec = promisify(execFile)
const psql = (...args) => exec('psql', [db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', ...args], { timeout: 20000 })
const query = (sql) => psql('-c', sql)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitFor(sql) {
  for (let i = 0; i < 60; i++) {
    if ((await query(sql)).stdout.trim() === 't') return
    await delay(100)
  }
  throw Error('EXPECTED_DATABASE_WAIT_NOT_OBSERVED')
}
const source = await readFile('experiments/supabase-auth/ai-concurrency-review.sql', 'utf8')
const marker = '  today := (clock_timestamp() AT TIME ZONE \'UTC\')::date;'
assert.ok(source.includes(marker), 'Expected post-lock day calculation')
// A sequence is deliberately used: unlike a table, its values are visible across a waiting statement's snapshot.
const simulated = source.replaceAll('clock_timestamp()', 'public.architekt_fixture_clock()')
const oldBehavior = simulated
  .replace('DECLARE today date;', "DECLARE today date := (public.architekt_fixture_clock() AT TIME ZONE 'UTC')::date;")
  .replace("  today := (public.architekt_fixture_clock() AT TIME ZONE 'UTC')::date;", '')
assert.notEqual(oldBehavior, simulated)

async function scenario(sql) {
  await query('DROP FUNCTION IF EXISTS public.architekt_ai_acquire(); DROP FUNCTION IF EXISTS public.architekt_ai_release(uuid); DROP TABLE IF EXISTS public.architekt_ai_admission')
  await query(sql)
  await query("SELECT setval('public.architekt_fixture_clock_seq', extract(epoch from '2026-11-17 23:59:50+00'::timestamptz)::bigint, false); INSERT INTO public.architekt_ai_admission (id, day, used) VALUES (true, '2026-11-17', 10)")
  const holder = query("SET application_name = 'architekt_midnight_holder'; BEGIN; SELECT id FROM public.architekt_ai_admission FOR UPDATE; SELECT pg_sleep(8); COMMIT")
  try {
    await waitFor("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = 'architekt_midnight_holder' AND wait_event = 'PgSleep')")
    const waiter = query("SET application_name = 'architekt_midnight_waiter'; SET ROLE service_role; SELECT public.architekt_ai_acquire()")
    try {
      await waitFor("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = 'architekt_midnight_waiter' AND wait_event_type = 'Lock')")
      await query("SELECT setval('public.architekt_fixture_clock_seq', extract(epoch from '2026-11-18 00:00:00+00'::timestamptz)::bigint, false)")
      return JSON.parse((await waiter).stdout.trim())
    } finally { await waiter.catch(() => {}) }
  } finally { await holder.catch(() => {}) }
}
try {
  await query("CREATE SEQUENCE public.architekt_fixture_clock_seq; CREATE FUNCTION public.architekt_fixture_clock() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT to_timestamp(nextval('public.architekt_fixture_clock_seq')) $$")
  assert.equal((await scenario(oldBehavior)).status, 'LIMIT_REACHED', 'Regression control must reproduce the old error')
  assert.equal((await scenario(simulated)).status, 'ACQUIRED', 'New UTC day must be computed after lock wait')
  assert.equal((await query("SELECT day::text || ':' || used FROM public.architekt_ai_admission")).stdout.trim(), '2026-11-18:1')
  console.log('PASS: previous logic reproduces the midnight error; corrected logic counts the new UTC day')
} finally {
  await query('DROP FUNCTION IF EXISTS public.architekt_ai_acquire(); DROP FUNCTION IF EXISTS public.architekt_ai_release(uuid); DROP TABLE IF EXISTS public.architekt_ai_admission; DROP FUNCTION IF EXISTS public.architekt_fixture_clock(); DROP SEQUENCE IF EXISTS public.architekt_fixture_clock_seq').catch(() => {})
}
