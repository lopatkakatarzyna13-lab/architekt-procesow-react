// CI fixture only: localhost, disposable Supabase, fictional identities and fake analysis.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { createExperimentalVerifier } from './verify.js'

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY, DB_URL } = process.env
for (const value of [API_URL, DB_URL]) {
  if (!value || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname)) throw new Error('LOCAL_TEST_ONLY')
}
if (!ANON_KEY || !SERVICE_ROLE_KEY) throw new Error('Missing local configuration')
const exec = promisify(execFile)
const query = (sql) => exec('psql', [DB_URL, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql])
const admin = createClient(API_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const password = 'fictional-password-for-isolated-ci-729!'
const users = []
let browser, server, vite, authDown = false, calls = 0
try {
  for (const email of ['browser-owner@example.test', 'browser-other@example.test']) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error || !data.user?.id) throw new Error('Could not create fictional account')
    users.push(data.user.id)
  }
  await query('CREATE TABLE public.fixture_browser_quota (id integer PRIMARY KEY, used integer NOT NULL); INSERT INTO public.fixture_browser_quota VALUES (1, 0)')
  const verify = createExperimentalVerifier({ url: API_URL, publishableKey: ANON_KEY, allowedUserId: users[0], fetchImpl: (...args) => authDown ? fetch('http://127.0.0.1:1/unavailable') : fetch(...args) })
  server = createServer(async (req, res) => {
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
    if (req.method !== 'POST' || req.url !== '/api/analyze-workshop') return reply(404, { error: 'NOT_FOUND' })
    const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1]
    if (!token || !(await verify(token))) return reply(403, { error: 'FORBIDDEN' })
    let body = ''
    for await (const chunk of req) { body += chunk; if (body.length > 25000) return reply(413, { error: 'TOO_LARGE' }) }
    let transcript
    try { transcript = JSON.parse(body).transcript } catch { return reply(400, { error: 'INVALID_REQUEST' }) }
    if (transcript !== 'HR sprawdza dane') return reply(400, { error: 'INVALID_REQUEST' })
    try {
      const result = await query('UPDATE public.fixture_browser_quota SET used = used + 1 WHERE id = 1 AND used < 3 RETURNING used')
      if (!result.stdout.trim()) return reply(429, { error: 'LIMIT_REACHED' })
    } catch { return reply(503, { error: 'USAGE_STORAGE_UNAVAILABLE' }) }
    calls += 1
    return reply(200, { proposal: { steps: [{ text: 'Sprawdzenie danych', status: 'supported', evidence: 'HR sprawdza dane' }], roles: [], decisions: [], questions: [] } })
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8787, '127.0.0.1', resolve) })
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { env: { ...process.env, VITE_TEST_AUTH_URL: API_URL, VITE_TEST_ANON_KEY: ANON_KEY }, stdio: 'ignore' })
  let ready = false
  for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:5173/')).ok) { ready = true; break } } catch { /* wait for Vite */ } await delay(250) }
  if (!ready) throw new Error('Vite did not start')
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const page = await context.newPage()
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('http://127.0.0.1:5173/experiments/supabase-auth/browser-test.html')
  const login = async (email) => {
    await page.getByLabel('E-mail testowy').fill(email)
    await page.getByLabel('Hasło testowe').fill(password)
    await page.getByRole('button', { name: 'Zaloguj testowo' }).click()
    await page.getByText('Zalogowano testowo').waitFor()
  }
  await login('browser-other@example.test')
  await page.getByRole('button', { name: /Dodaj kroki samodzielnie/ }).click()
  await page.getByLabel(/Nazwa procesu/).fill('Fikcyjny proces AI')
  await page.getByLabel(/Cel procesu/).fill('Przygotowanie danych')
  await page.getByLabel(/Co rozpoczyna proces/).fill('Zgłoszenie')
  await page.getByLabel(/Co kończy proces/).fill('Przekazanie')
  await page.getByRole('button', { name: /Zapisz zakres i przejdź dalej/ }).click()
  await page.getByLabel('Tekst rozmowy').fill('HR sprawdza dane')
  await page.getByRole('button', { name: 'Zapisz transkrypcję' }).click()
  const call = () => page.evaluate(async () => (await fetch('/api/analyze-workshop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: 'HR sprawdza dane' }) })).status)
  assert.equal(await call(), 403, 'another authenticated account is denied')
  assert.equal(calls, 0)
  await page.getByRole('button', { name: 'Wyloguj testowo' }).click()
  assert.equal(await call(), 403, 'missing token is denied')
  await login('browser-owner@example.test')
  await page.getByRole('button', { name: 'Analizuj transkrypcję' }).click()
  await page.getByLabel('Kroki — pozycja 1').waitFor()
  assert.equal(await page.getByLabel('Kroki — pozycja 1').inputValue(), 'Sprawdzenie danych')
  await page.getByRole('button', { name: 'Zapisz propozycję' }).click()
  await page.getByRole('checkbox', { name: 'Wybierz krok 1 do przeniesienia' }).check()
  await page.getByRole('button', { name: 'Przenieś wybrane kroki do AS-IS' }).click()
  await page.getByRole('button', { name: 'Zapisz proces AS-IS' }).click()
  await page.getByText('Proces AS-IS został zapisany').waitFor()
  await page.getByRole('button', { name: /Nowy proces/ }).click()
  await page.evaluate(() => sessionStorage.setItem('architekt-procesow-screen-to-open', 'processes'))
  await page.reload()
  await page.getByRole('button', { name: 'Otwórz proces' }).click()
  assert.equal(await page.getByLabel('Tekst rozmowy').inputValue(), 'HR sprawdza dane')
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('architekt-procesow:as-is')).steps.map((x) => x.name)), ['Sprawdzenie danych'])
  // Re-login because the intentionally in-memory test session was cleared by reload.
  await login('browser-owner@example.test')
  const results = await Promise.all(Array.from({ length: 6 }, call))
  assert.equal(results.filter((status) => status === 200).length, 2)
  assert.equal(results.filter((status) => status === 429).length, 4)
  assert.equal(calls, 3)
  await page.getByRole('button', { name: 'Analizuj transkrypcję' }).click()
  await page.getByText(/Osiągnięto limit 12 prób/).waitFor()
  await query('DROP TABLE public.fixture_browser_quota')
  assert.equal(await call(), 503)
  await page.getByRole('button', { name: 'Analizuj transkrypcję' }).click()
  await page.getByText(/Nie można odczytać lokalnego licznika/).waitFor()
  authDown = true
  assert.equal(await call(), 403, 'unavailable auth fails closed')
  authDown = false
  await context.route(`${API_URL}/auth/v1/token**`, (route) => route.abort())
  await page.getByRole('button', { name: 'Wyloguj testowo' }).click()
  await page.getByRole('button', { name: 'Zaloguj testowo' }).click()
  await page.getByText('Logowanie niedostępne lub niepoprawne').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Opracuj ręcznie' }).click()
  await page.getByRole('button', { name: 'Dodaj: kroki' }).click()
  await page.getByLabel('Kroki — pozycja 1').fill('Ręczna kontrola')
  await page.getByRole('button', { name: 'Zapisz propozycję' }).click()
  await page.getByText('Propozycja zapisana na tym urządzeniu.').waitFor()
  assert.equal(calls, 3)
  console.log('PASS: local browser login, authorized fake analysis, approval, saved process reopening, denial, quota, database failure and manual work')
  console.log('PASS: authorization service connection failure fails closed; browser login outage simulated by network abort')
} finally {
  if (browser) await browser.close()
  if (vite) vite.kill('SIGTERM')
  if (server) await new Promise((resolve) => server.close(resolve))
  await query('DROP TABLE IF EXISTS public.fixture_browser_quota').catch(() => {})
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => {})
}
