import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import { preview } from 'vite'

const fullSeconds = Number(process.env.WORKSHOP_RECORD_SECONDS ?? 15)
assert.ok(Number.isInteger(fullSeconds) && fullSeconds >= 15 && fullSeconds <= 3600)
const interruptedSeconds = 27
const origin = 'http://127.0.0.1:4173'
const name = 'Fikcyjna próba czasu nagrania'
const profile = await mkdtemp(join(tmpdir(), 'architekt-recording-duration-'))
const externalRequests = []
const run = promisify(execFile)
let server
let context

async function launch() {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  })
  await context.route('**/*', (route) => {
    const { origin: requestOrigin, pathname } = new URL(route.request().url())
    if (requestOrigin === origin && !pathname.startsWith('/api/')) return route.continue()
    externalRequests.push(route.request().url())
    return route.abort('internetdisconnected')
  })
  const page = context.pages()[0] ?? await context.newPage()
  await page.goto(origin)
  await page.getByText('Warsztat lokalny · zapis w tej przeglądarce').waitFor()
  return page
}

async function startRecording(page) {
  await page.getByRole('button', { name: 'Rozpocznij nagranie' }).click()
  await page.getByText('Trwa nagrywanie.', { exact: true }).waitFor()
  const started = performance.now()
  await page.getByText('Trwa nagrywanie. Fragment zapisany.', { exact: true }).waitFor()
  return started
}

async function checkRecording(page, filename) {
  const audio = page.getByLabel('Odsłuch nagrania warsztatu')
  await audio.evaluate((player) => player.play())
  await page.waitForFunction(() => document.querySelector('audio').currentTime > 0.2)
  const link = page.getByRole('link', { name: 'Pobierz nagranie' })
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
  const file = join(profile, filename)
  await download.saveAs(file)
  const { stdout, stderr } = await run('ffmpeg', [
    '-hide_banner', '-nostdin', '-loglevel', 'error', '-protocol_whitelist', 'file',
    '-i', file, '-map', '0:a:0', '-progress', 'pipe:1', '-f', 'null', '-',
  ])
  const errors = stderr.trim().split(/\r?\n/).filter(Boolean)
  assert.ok(errors.every((line) => /File ended prematurely/.test(line) && filename === 'recovered.webm'), stderr)
  const times = [...stdout.matchAll(/^out_time_us=(\d+)\s*$/gm)]
  const decoded = Number(times.at(-1)?.[1]) / 1e6
  assert.ok(decoded > 0, stdout)
  return decoded
}

try {
  server = await preview({ mode: 'workshop-local' })
  let page = await launch()
  await page.getByRole('button', { name: /Dodaj kroki samodzielnie/ }).click()
  await page.getByLabel(/Nazwa procesu/).fill(name)
  await page.getByLabel(/Cel procesu/).fill('Sprawdzenie długiego nagrania')
  await page.getByLabel(/Co rozpoczyna proces/).fill('Fikcyjne zgłoszenie')
  await page.getByLabel(/Co kończy proces/).fill('Zapis próby')
  await page.getByRole('button', { name: 'Zapisz zakres i przejdź dalej' }).click()

  let started = await startRecording(page)
  console.log(`Nagrywanie bez przerwy przez ${fullSeconds} s na ${process.platform}.`)
  await delay(Math.max(0, fullSeconds * 1000 - (performance.now() - started)))
  await page.getByRole('button', { name: 'Zatrzymaj nagranie' }).click()
  await page.getByText('Nagranie zapisane w tej przeglądarce.').waitFor()
  const fullDecoded = await checkRecording(page, 'finished.webm')
  assert.ok(fullDecoded >= fullSeconds - 2, `Oczekiwano ${fullSeconds} s, zdekodowano ${fullDecoded} s.`)
  console.log(`PASS: zdekodowano ${fullDecoded.toFixed(2)} s zakończonego nagrania.`)

  page.once('dialog', (prompt) => prompt.accept())
  started = await startRecording(page)
  await delay(Math.max(0, interruptedSeconds * 1000 - (performance.now() - started)))
  const elapsed = (performance.now() - started) / 1000
  await page.close()
  await context.close()
  context = undefined
  page = await launch()
  await page.getByRole('button', { name: 'Moje procesy' }).click()
  await page.locator('.process-card').filter({ hasText: name }).getByRole('button', { name: 'Otwórz proces' }).click()
  await page.getByText('Dostępna zapisana część przerwanego nagrania.').waitFor()
  const recovered = await checkRecording(page, 'recovered.webm')
  assert.ok(recovered >= interruptedSeconds - 8 && recovered <= elapsed + 2, `Po ${elapsed.toFixed(2)} s odzyskano ${recovered.toFixed(2)} s.`)
  assert.deepEqual(externalRequests, [])
  console.log(`PASS: po zamknięciu karty odzyskano ${recovered.toFixed(2)} s z około ${elapsed.toFixed(2)} s (różnica ${Math.max(0, elapsed - recovered).toFixed(2)} s).`)
} finally {
  try {
    await context?.close()
  } finally {
    await server?.close()
    await rm(profile, { recursive: true, force: true })
  }
}
