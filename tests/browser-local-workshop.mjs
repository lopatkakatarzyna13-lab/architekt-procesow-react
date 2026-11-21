import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { preview } from 'vite'

const origin = 'http://127.0.0.1:4173'
const name = 'Fikcyjny warsztat bez internetu'
const transcript = 'Kierownik przekazuje formularz.\nHR sprawdza kompletność.'
const step = 'Sprawdzenie kompletności formularza'
const nextStep = 'Przekazanie potwierdzenia'
const profile = await mkdtemp(join(tmpdir(), 'architekt-local-workshop-'))
const remoteRequests = []
let server
let context

async function openWorkshop() {
  server = await preview({ mode: 'workshop-local' })
  context = await chromium.launchPersistentContext(profile, { headless: true })
  await context.route('**/*', (route) => {
    const { origin: requestOrigin, pathname } = new URL(route.request().url())
    if (requestOrigin === origin && !pathname.startsWith('/api/')) return route.continue()
    remoteRequests.push(route.request().url())
    return route.abort('internetdisconnected')
  })
  const page = context.pages()[0] ?? await context.newPage()
  await page.goto(origin)
  await page.getByText('Warsztat lokalny · zapis w tej przeglądarce').waitFor()
  assert.equal(await page.getByRole('button', { name: /Supabase/ }).count(), 0)
  return page
}

async function closeWorkshop() {
  try {
    if (context) await context.close()
  } finally {
    if (server) await server.close()
    context = undefined
    server = undefined
  }
}

try {
  let page = await openWorkshop()
  await page.getByRole('button', { name: /Dodaj kroki samodzielnie/ }).click()
  await page.getByLabel(/Nazwa procesu/).fill(name)
  await page.getByLabel(/Cel procesu/).fill('Potwierdzenie przyjęcia formularza')
  await page.getByLabel(/Co rozpoczyna proces/).fill('Przekazanie formularza')
  await page.getByLabel(/Co kończy proces/).fill('Potwierdzenie przyjęcia')
  await page.getByRole('button', { name: 'Zapisz zakres i przejdź dalej' }).click()
  const upload = page.getByLabel('Wczytaj transkrypcję z pliku TXT')
  await upload.setInputFiles({ name: 'warsztat.txt', mimeType: 'text/plain', buffer: Buffer.from('\ufeff' + transcript.replace('\n', '\r\n')) })
  await page.getByText(/Wczytano tekst z pliku/).waitFor()
  assert.equal(await page.getByLabel('Tekst rozmowy', { exact: true }).inputValue(), transcript)
  await page.getByRole('button', { name: 'Zapisz transkrypcję' }).click()
  await page.getByText('Transkrypcja zapisana na tym urządzeniu.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Analizuj transkrypcję' }).isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Zaloguj do analizy AI' }).count(), 0)

  await page.getByRole('button', { name: 'Opracuj ręcznie' }).click()
  await page.getByRole('button', { name: 'Dodaj: kroki' }).click()
  await page.getByLabel('Kroki — pozycja 1').fill(step)
  await page.getByRole('button', { name: 'Zapisz propozycję' }).click()
  await page.getByRole('checkbox', { name: 'Wybierz krok 1 do przeniesienia' }).check()
  await page.getByRole('button', { name: 'Przenieś wybrane kroki do AS-IS' }).click()
  await page.getByRole('button', { name: 'Zapisz proces AS-IS' }).click()
  await page.getByText('Proces AS-IS został zapisany').waitFor()
  await closeWorkshop()

  page = await openWorkshop()
  await page.getByRole('button', { name: 'Moje procesy' }).click()
  const card = page.locator('.process-card').filter({ hasText: name })
  await card.getByText('Wersja 1 · W toku').waitFor()
  await card.getByRole('button', { name: 'Otwórz proces' }).click()
  const transcriptField = page.getByLabel('Tekst rozmowy', { exact: true })
  assert.equal(await transcriptField.inputValue(), transcript)
  assert.equal(await page.getByLabel('Kroki — pozycja 1').inputValue(), step)
  await page.locator('ol.steps-list').getByText(step, { exact: true }).waitFor()

  const replacement = page.getByLabel('Wczytaj transkrypcję z pliku TXT')
  const dialog = page.waitForEvent('dialog').then(async (prompt) => {
    assert.match(prompt.message(), /Wczytać plik w miejsce bieżącej transkrypcji/)
    await prompt.dismiss()
  })
  await replacement.setInputFiles({ name: 'fragment.txt', mimeType: 'text/plain', buffer: Buffer.from('Inny fragment rozmowy') })
  await dialog
  assert.equal(await transcriptField.inputValue(), transcript)
  await replacement.setInputFiles({ name: 'za-duzy.txt', mimeType: 'text/plain', buffer: Buffer.from('a'.repeat(100_001)) })
  await page.getByText(/Plik przekracza limit 100000 znaków/).waitFor()
  assert.equal(await transcriptField.inputValue(), transcript)
  await replacement.setInputFiles({ name: 'bledny.txt', mimeType: 'text/plain', buffer: Buffer.from([0xc3, 0x28]) })
  await page.getByText('Nie udało się odczytać pliku TXT w UTF-8.').waitFor()
  assert.equal(await transcriptField.inputValue(), transcript)

  await page.getByRole('button', { name: 'Dodaj: kroki' }).click()
  await page.getByLabel('Kroki — pozycja 2').fill(nextStep)
  await page.getByRole('button', { name: 'Zapisz propozycję' }).click()
  await page.getByText('Propozycja zapisana na tym urządzeniu.').waitFor()
  assert.deepEqual(remoteRequests, [])
  console.log('PASS: offline TXT import and validation, cancelled replacement, and workshop recovery after browser and server restart')
} finally {
  try {
    await closeWorkshop()
  } finally {
    await rm(profile, { recursive: true, force: true })
  }
}
