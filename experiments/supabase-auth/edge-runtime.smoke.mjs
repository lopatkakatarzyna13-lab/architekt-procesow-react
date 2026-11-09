// Runs the real local Edge runtime against disposable local Auth and PostgreSQL.
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, unlink } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY, DB_URL, EDGE_TEST_DIR } = process.env
for (const value of [API_URL, DB_URL]) {
  if (!value || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname)) throw new Error('LOCAL_TEST_ONLY')
}
if (!ANON_KEY || !SERVICE_ROLE_KEY || !EDGE_TEST_DIR) throw new Error('Missing local test configuration')
const exec = promisify(execFile)
const query = (sql) => exec('psql', [DB_URL, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql])
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(API_URL, SERVICE_ROLE_KEY, opts)
const client = createClient(API_URL, ANON_KEY, opts)
const password = 'fictional-password-for-edge-ci-729!'
const users = []
const envFile = `${EDGE_TEST_DIR}/edge-fixture.env`
let edge
try {
  const tokens = []
  for (const email of ['edge-owner@example.test', 'edge-other@example.test']) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error || !data.user?.id) throw new Error('Could not create fixture account')
    users.push(data.user.id)
    const session = await client.auth.signInWithPassword({ email, password })
    if (session.error || !session.data.session?.access_token) throw new Error('Fixture sign-in failed')
    tokens.push(session.data.session.access_token)
  }
  await exec('psql', [DB_URL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 'experiments/supabase-auth/edge-fixture.sql'])
  await writeFile(envFile, `ARCHITEKT_FIXTURE_MODE=true\nARCHITEKT_TEST_ORIGIN=http://127.0.0.1:5173\nARCHITEKT_TEST_USER_ID=${users[0]}\n`, { mode: 0o600 })
  edge = spawn('supabase', ['functions', 'serve', '--env-file', envFile], { cwd: EDGE_TEST_DIR, stdio: 'ignore' })
  const endpoint = `${API_URL}/functions/v1/workshop-fixture`
  const send = (token, { origin = 'http://127.0.0.1:5173', body = '{"transcript":"HR sprawdza dane"}', method = 'POST' } = {}) => fetch(endpoint, {
    method, headers: { apikey: ANON_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}), Origin: origin, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body } : {}),
  })
  let ready = false
  for (let i = 0; i < 120; i++) {
    try { if ((await send(tokens[0], { body: '{}' })).status === 400) { ready = true; break } } catch { /* runtime starting */ }
    await delay(500)
  }
  if (!ready) throw new Error('Local Edge runtime did not become ready')
  assert.ok([401, 403].includes((await send()).status), 'missing token')
  assert.equal((await send(tokens[1])).status, 403, 'other account')
  assert.equal((await send(tokens[0], { origin: 'http://not-allowed.test' })).status, 403, 'foreign origin')
  assert.equal((await send(tokens[0], { method: 'GET' })).status, 405, 'reject unsupported method')
  const preflight = await send(tokens[0], { method: 'OPTIONS' })
  assert.equal(preflight.status, 204, 'allow preflight for the trusted origin')
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173')
  const wrongType = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${tokens[0]}`, Origin: 'http://127.0.0.1:5173', 'Content-Type': 'text/plain' },
    body: '{"transcript":"HR sprawdza dane"}',
  })
  assert.equal(wrongType.status, 415, 'reject wrong content type')
  const malformedAuth = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: 'Bearer malformed token', Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
    body: '{"transcript":"HR sprawdza dane"}',
  })
  assert.equal(malformedAuth.status, 403, 'reject malformed bearer token')
  assert.equal((await send(tokens[0], { body: 'null' })).status, 400, 'reject null payload')
  assert.equal((await send(tokens[0], { body: '{' })).status, 400, 'invalid JSON')
  assert.equal((await send(tokens[0], { body: JSON.stringify({ transcript: 'x'.repeat(5000) }) })).status, 413)
  const first = await send(tokens[0])
  assert.equal(first.status, 200)
  assert.equal((await first.json()).proposal.steps[0].evidence, 'HR sprawdza dane')
  const results = await Promise.all(Array.from({ length: 6 }, () => send(tokens[0])))
  assert.equal(results.filter((r) => r.status === 200).length, 2)
  assert.equal(results.filter((r) => r.status === 429).length, 4)
  const total = await query('SELECT used FROM public.architekt_fixture_quota WHERE id = 1')
  assert.equal(total.stdout.trim(), '3')
  const denied = await fetch(`${API_URL}/rest/v1/rpc/architekt_fixture_reserve`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${tokens[0]}`, 'Content-Type': 'application/json' }, body: '{}' })
  assert.ok([401, 403, 404].includes(denied.status), 'authenticated user cannot call quota function')
  await query('DROP TABLE public.architekt_fixture_quota')
  assert.equal((await send(tokens[0])).status, 503, 'quota database error blocks analysis')
  console.log('PASS: actual local Edge runtime enforces identity, origin, bounded input, atomic quota and fail-closed database errors with fake analysis')
} finally {
  if (edge) edge.kill('SIGTERM')
  await unlink(envFile).catch(() => {})
  await query('DROP FUNCTION IF EXISTS public.architekt_fixture_reserve(); DROP TABLE IF EXISTS public.architekt_fixture_quota').catch(() => {})
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => {})
}
