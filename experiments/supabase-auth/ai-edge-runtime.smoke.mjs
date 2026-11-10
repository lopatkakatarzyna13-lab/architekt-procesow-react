// Disposable local stack only. The real adapter runs; only the provider response is simulated.
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, cp, rename, writeFile, unlink } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
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
let edge, vite, browser
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
  await cp('supabase/functions/_shared', `${EDGE_TEST_DIR}/supabase/functions/_shared`, { recursive: true })
  // The original entry and its imports stay intact. The test bootstrap intercepts
  // the only provider URL before loading the entry, so no paid request is sent.
  const functionDir = `${EDGE_TEST_DIR}/supabase/functions/workshop-ai`
  await rename(`${functionDir}/index.ts`, `${functionDir}/entry.ts`)
  await writeFile(`${functionDir}/index.ts`, `
const realFetch = globalThis.fetch
const fakeProposal = { steps: [{ text: 'Fikcyjny proces', status: 'supported', evidence: 'Fikcyjny proces' }], roles: [], decisions: [], questions: [] }
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url === 'https://api.openai.com/v1/responses') {
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(fakeProposal) }] }] })
  }
  if (!url.startsWith(Deno.env.get('SUPABASE_URL') + '/')) throw new Error('TEST_NETWORK_BLOCKED')
  try {
    const response = await realFetch(input, init)
    if (url.endsWith('/rest/v1/rpc/architekt_ai_reserve') && !response.ok) {
      const body = await response.clone().json().catch(() => ({}))
      const code = typeof body.code === 'string' && /^[A-Z0-9]{5,8}$/.test(body.code) ? body.code : 'unavailable'
      console.log('TEST_QUOTA_FAILURE', response.status, code)
    }
    return response
  } catch (error) {
    console.log('TEST_NETWORK_FAILURE', error?.name === 'AbortError' || error?.name === 'TimeoutError' ? error.name : 'other')
    throw error
  }
}
await import('./entry.ts')
`)
  await writeFile(envFile, `ARCHITEKT_AI_ENABLED=true\nARCHITEKT_AI_ORIGIN=http://127.0.0.1:5173\nARCHITEKT_AI_OWNER_ID=${users[0]}\nOPENAI_API_KEY=fake-ci-only\n`, { mode: 0o600 })
  edge = spawn('supabase', ['functions', 'serve', '--env-file', envFile], { cwd: EDGE_TEST_DIR, stdio: ['ignore', 'pipe', 'pipe'] })
  // Forward only explicitly safe diagnostics, never runtime request logs or tokens.
  for (const stream of [edge.stdout, edge.stderr]) {
    let pending = ''
    stream.on('data', (chunk) => {
      pending += chunk.toString()
      const lines = pending.split('\n'); pending = lines.pop().slice(-1000)
      for (const line of lines) {
        const match = line.match(/TEST_(?:QUOTA_FAILURE [0-9]{3} (?:[A-Z0-9]{5,8}|unavailable)|NETWORK_FAILURE (?:AbortError|TimeoutError|other))/)
        if (match) console.log(match[0])
      }
    })
  }
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
  assert.deepEqual((await first.json()).proposal, { steps: [{ text: 'Fikcyjny proces', status: 'supported', evidence: 'Fikcyjny proces' }], roles: [], decisions: [], questions: [] })
  for (let round = 1; round <= 5; round++) {
    if (round > 1) {
      await query('DELETE FROM public.architekt_ai_quota')
      assert.equal((await send(tokens[0])).status, 200)
    }
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => send(tokens[0])))
    const observed = await Promise.all(results.map(async (result) => {
      if (result.status === 'rejected') {
        const code = result.reason?.cause?.code === 'UND_ERR_SOCKET' ? 'SOCKET_CLOSED' : 'NETWORK_ERROR'
        return { status: 0, error: code }
      }
      const r = result.value
      const body = await r.json().catch(() => ({}))
      const safeErrors = ['LIMIT_REACHED', 'USAGE_STORAGE_UNAVAILABLE', 'AUTH_UNAVAILABLE', 'ANALYSIS_FAILED', 'FORBIDDEN', 'UNAUTHORIZED']
      return { status: r.status, error: safeErrors.includes(body.error) ? body.error : body.error ? 'OTHER' : undefined }
    }))
    const used = (await query('SELECT used FROM public.architekt_ai_quota')).stdout.trim()
    const counts = observed.reduce((acc, r) => { const key = `${r.status}:${r.error || 'none'}`; acc[key] = (acc[key] || 0) + 1; return acc }, {})
    console.log('Round', round, 'concurrent response counts:', JSON.stringify(counts), 'quota used:', used)
    assert.equal(observed.filter((r) => r.status === 200).length, 9)
    assert.equal(observed.filter((r) => r.status === 429 && r.error === 'LIMIT_REACHED').length, 3)
    assert.equal(used, '10')
  }
  // Real app + in-memory Supabase session + actual Edge entry and adapter.
  await query('DELETE FROM public.architekt_ai_quota')
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    env: { ...process.env, VITE_SUPABASE_URL: API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: ANON_KEY, VITE_WORKSHOP_AI_MODE: 'supabase', VITE_WORKSHOP_AI_ENABLED: 'true' }, stdio: 'ignore',
  })
  let webReady = false
  for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:5173/')).ok) { webReady = true; break } } catch { /* wait */ } await delay(250) }
  if (!webReady) throw Error('VITE_NOT_READY')
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('http://127.0.0.1:5173/')
  await page.getByRole('button', { name: /Dodaj kroki samodzielnie/ }).click()
  await page.getByLabel(/Nazwa procesu/).fill('Fikcyjny warsztat Edge')
  await page.getByLabel(/Cel procesu/).fill('Przygotowanie danych')
  await page.getByLabel(/Co rozpoczyna proces/).fill('Zgłoszenie')
  await page.getByLabel(/Co kończy proces/).fill('Przekazanie')
  await page.getByRole('button', { name: /Zapisz zakres i przejdź dalej/ }).click()
  await page.getByLabel('Tekst rozmowy').fill('Fikcyjny proces')
  await page.getByRole('button', { name: 'Zapisz transkrypcję' }).click()
  await page.getByRole('button', { name: 'Analizuj transkrypcję' }).click()
  await page.getByText('Zaloguj się, aby uruchomić analizę AI.').waitFor()
  assert.equal((await query('SELECT count(*) FROM public.architekt_ai_quota')).stdout.trim(), '0')
  await page.getByLabel('E-mail do analizy AI').fill('ai-owner@example.test')
  await page.getByLabel('Hasło do analizy AI').fill(password)
  await page.getByRole('button', { name: 'Zaloguj do analizy AI' }).click()
  await page.getByText('Zalogowano do analizy AI.').waitFor()
  await page.getByRole('button', { name: 'Analizuj transkrypcję' }).click()
  assert.equal(await page.getByLabel('Kroki — pozycja 1').inputValue(), 'Fikcyjny proces')
  assert.equal((await query('SELECT used FROM public.architekt_ai_quota')).stdout.trim(), '1')
  await page.getByRole('button', { name: 'Zapisz propozycję' }).click()
  await page.getByRole('checkbox', { name: 'Wybierz krok 1 do przeniesienia' }).check()
  await page.getByRole('button', { name: 'Przenieś wybrane kroki do AS-IS' }).click()
  await page.getByRole('button', { name: 'Zapisz proces AS-IS' }).click()
  await page.getByText('Proces AS-IS został zapisany').waitFor()
  await page.getByRole('button', { name: /Nowy proces/ }).click()
  await page.evaluate(() => sessionStorage.setItem('architekt-procesow-screen-to-open', 'processes'))
  await page.reload()
  await page.getByRole('button', { name: 'Otwórz proces' }).click()
  assert.equal(await page.getByLabel('Tekst rozmowy').inputValue(), 'Fikcyjny proces')
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('architekt-procesow:as-is')).steps.map((item) => item.name)), ['Fikcyjny proces'])
  assert.ok(await page.getByRole('button', { name: 'Zaloguj do analizy AI' }).isVisible(), 'session must not persist across reload')
  await browser.close(); browser = null
  vite.kill('SIGTERM'); vite = null
  console.log('PASS: browser login, real Edge adapter, fake provider, review, AS-IS save and reopen')
  await query('DROP TABLE public.architekt_ai_quota')
  assert.equal((await send(tokens[0])).status, 503)
  console.log('PASS: real AI Edge entry with local Auth and quota, real adapter and simulated offline provider')
} finally {
  if (browser) await browser.close().catch(() => {})
  if (vite) vite.kill('SIGTERM')
  if (edge) edge.kill('SIGTERM')
  await unlink(envFile).catch(() => {})
  await query('DROP FUNCTION IF EXISTS public.architekt_ai_reserve(); DROP TABLE IF EXISTS public.architekt_ai_quota').catch(() => {})
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => {})
}
