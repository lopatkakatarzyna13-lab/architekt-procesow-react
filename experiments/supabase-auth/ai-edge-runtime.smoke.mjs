// Disposable local stack only. The temporary copy of the AI adapter is replaced by a non-network stub.
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, cp, readFile, writeFile, unlink } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'
const { API_URL, DB_URL, ANON_KEY, SERVICE_ROLE_KEY, EDGE_TEST_DIR } = process.env
for (const value of [API_URL, DB_URL]) if (!value || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) throw Error('LOCAL_ONLY')
if (!ANON_KEY || !SERVICE_ROLE_KEY || !EDGE_TEST_DIR) throw Error('MISSING_CONFIG')
const exec = promisify(execFile)
const query = (sql) => exec('psql', [DB_URL, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql])
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(API_URL, SERVICE_ROLE_KEY, opts)
const client = createClient(API_URL, ANON_KEY, opts)
const users = [], tokens = []
const password = 'fictional-password-ci-948!'
const envFile = `${EDGE_TEST_DIR}/ai-test.env`
let edge
try {
  for (const email of ['ai-owner@example.test', 'ai-other@example.test']) {
    const u = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (u.error || !u.data.user?.id) throw Error('CREATE_USER_FAILED')
    users.push(u.data.user.id)
    const login = await client.auth.signInWithPassword({ email, password })
    if (login.error || !login.data.session?.access_token) throw Error('LOGIN_FAILED')
    tokens.push(login.data.session.access_token)
  }
  await query('DROP FUNCTION IF EXISTS public.architekt_ai_reserve(); DROP TABLE IF EXISTS public.architekt_ai_quota')
  await exec('psql', [DB_URL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 'experiments/supabase-auth/ai-quota-review.sql'])
  await mkdir(`${EDGE_TEST_DIR}/supabase/functions`, { recursive: true })
  await cp('supabase/functions/workshop-ai', `${EDGE_TEST_DIR}/supabase/functions/workshop-ai`, { recursive: true })
  // Redirect only the disposable copy to a stub inside the Edge runtime mount.
  const indexPath = `${EDGE_TEST_DIR}/supabase/functions/workshop-ai/index.ts`
  const source = await readFile(indexPath, 'utf8')
  const originalImport = '../../../server/analyzeWorkshop.js'
  if (!source.includes(originalImport)) throw Error('ADAPTER_IMPORT_NOT_FOUND')
  await writeFile(indexPath, source.replace(originalImport, './fake-analyzer.js'))
  await writeFile(`${EDGE_TEST_DIR}/supabase/functions/workshop-ai/fake-analyzer.js`, "export async function analyzeWorkshop() { return { steps: [], roles: [], decisions: [], questions: [] } }\n")
  await writeFile(envFile, `ARCHITEKT_AI_ENABLED=true\nARCHITEKT_AI_ORIGIN=http://127.0.0.1:5173\nARCHITEKT_AI_OWNER_ID=${users[0]}\nOPENAI_API_KEY=fake-ci-only\n`, { mode: 0o600 })
  edge = spawn('supabase', ['functions', 'serve', '--env-file', envFile], { cwd: EDGE_TEST_DIR, stdio: 'ignore' })
  const endpoint = `${API_URL}/functions/v1/workshop-ai`
  const send = (token, body = '{"transcript":"Fikcyjny proces"}') => fetch(endpoint, { method: 'POST', headers: { apikey: ANON_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}), Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' }, body })
  let ready = false
  let exitCode = 'running'
  edge.on('exit', (code) => { exitCode = String(code) })
  const seen = new Set()
  for (let i = 0; i < 120; i++) {
    try {
      if (i > 0 && i % 30 === 0) {
        const s = await client.auth.signInWithPassword({ email: 'ai-owner@example.test', password })
        if (s.error || !s.data.session?.access_token) throw Error('RELOGIN_FAILED')
        tokens[0] = s.data.session.access_token
      }
      const r = await send(tokens[0], '{}')
      let status = String(r.status)
      if (r.status === 503) {
        const body = await r.json().catch(() => ({}))
        if (['NOT_CONFIGURED', 'AUTH_UNAVAILABLE', 'USAGE_STORAGE_UNAVAILABLE', 'ANALYSIS_FAILED'].includes(body.error)) status += ':' + body.error
        else status += ':runtime-or-gateway'
      }
      seen.add(status)
      if (r.status === 400) { ready = true; break }
    } catch { seen.add('connection-error') }
    await delay(500)
  }
  if (!ready) throw Error(`EDGE_NOT_READY: ${[...seen].join(',')}; serve exit: ${exitCode}`)
  assert.ok([401, 403].includes((await send()).status))
  assert.equal((await send(tokens[1])).status, 403)
  assert.equal((await query('SELECT count(*) FROM public.architekt_ai_quota')).stdout.trim(), '0')
  const first = await send(tokens[0])
  assert.equal(first.status, 200)
  assert.deepEqual((await first.json()).proposal, { steps: [], roles: [], decisions: [], questions: [] })
  const results = await Promise.all(Array.from({ length: 12 }, () => send(tokens[0])))
  assert.equal(results.filter((r) => r.status === 200).length, 9)
  assert.equal(results.filter((r) => r.status === 429).length, 3)
  assert.equal((await query('SELECT used FROM public.architekt_ai_quota')).stdout.trim(), '10')
  await query('DROP TABLE public.architekt_ai_quota')
  assert.equal((await send(tokens[0])).status, 503)
  console.log('PASS: real AI Edge entry with local Auth and quota, fake offline analysis')
} finally {
  if (edge) edge.kill('SIGTERM')
  await unlink(envFile).catch(() => {})
  await query('DROP FUNCTION IF EXISTS public.architekt_ai_reserve(); DROP TABLE IF EXISTS public.architekt_ai_quota').catch(() => {})
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => {})
}
