import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect } from 'playwright/test'
import { preview } from 'vite'

const origin = 'http://127.0.0.1:4173'
const remoteRequests = []
const server = await preview({ mode: 'workshop-local' })
const scenarios = [
  {
    name: 'Skierowanie na badania wstępne',
    file: 'proba-transkrypcji-lokalnej.md',
    heading: 'Dialog do powtórzenia próby',
    first: 'Zgłoszenie wysyła kierownik przez formularz w portalu kadrowym',
    corrected: 'Kierownik zgłasza osobę na badania przez portal kadrowy',
    next: 'Kierownik uzupełnia ten sam formularz w ciągu dwóch dni roboczych',
    question: /nie znamy liczby zgłoszeń/,
    exception: /system nie generuje pliku PDF/,
    outsideAsIs: /obowiązkowe pola|integracja z rejestrem|OCR/i,
  },
  {
    name: 'Przekazanie danych do biura rachunkowego',
    file: '02-dane-do-biura.md',
    heading: 'Transkrypcja',
    first: 'Do piątego dnia miesiąca menedżerowie wysyłają HR dane o nieobecnościach i zatwierdzonych premiach',
    corrected: 'Menedżerowie wysyłają dane do HR do piątego dnia miesiąca',
    next: 'Gdy dane są kompletne, przekazuję zestawienie do biura rachunkowego przez uzgodniony kanał',
    question: /menedżer nie odpowiada przed terminem/,
    exception: /po otrzymaniu uzupełnienia ponownie sprawdzam kompletność/i,
    outsideAsIs: /naliczanie wynagrodzeń|ścieżka eskalacji/i,
  },
]

async function openWorkshop(profile) {
  const context = await chromium.launchPersistentContext(profile, { headless: true })
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue()
    remoteRequests.push(url.href)
    return route.abort('internetdisconnected')
  })
  const page = context.pages()[0]
  await page.goto(origin)
  await page.getByText('Warsztat lokalny · zapis w tej przeglądarce').waitFor()
  return { context, page }
}

async function checkScenario(scenario) {
  const profile = await mkdtemp(join(tmpdir(), 'architekt-local-proposal-'))
  let context
  try {
    const doc = await readFile(new URL(`../docs/pilot-2.0/${scenario.file}`, import.meta.url), 'utf8')
    const transcript = doc.split(`## ${scenario.heading}\n\n`)[1].split('\n## ')[0].trim()
      .replace(/\*\*Głos ([AB])\.\*\*/g, 'Głos $1:')
    const firstVisit = await openWorkshop(profile)
    context = firstVisit.context
    let page = firstVisit.page
    await page.getByRole('button', { name: /Dodaj kroki samodzielnie/ }).click()
    await page.getByLabel(/Nazwa procesu/).fill(scenario.name)
    await page.getByLabel(/Cel procesu/).fill('Fikcyjna próba propozycji z transkrypcji')
    await page.getByLabel(/Co rozpoczyna proces/).fill('Zgłoszenie')
    await page.getByLabel(/Co kończy proces/).fill('Przekazanie informacji')
    await page.getByRole('button', { name: 'Zapisz zakres i przejdź dalej' }).click()
    const prepare = page.getByRole('button', { name: 'Przygotuj szkic AS-IS lokalnie' })
    await page.getByLabel('Tekst rozmowy', { exact: true }).fill(transcript)
    await expect(prepare).toBeDisabled()
    await page.getByRole('button', { name: 'Zapisz transkrypcję' }).click()
    await prepare.click()

    const fields = page.getByLabel(/^Kroki — pozycja \d+$/)
    const first = fields.first()
    const stepNames = await fields.evaluateAll((items) => items.map((item) => item.value))
    assert.equal(stepNames[0], scenario.first)
    assert.doesNotMatch(stepNames.join('\n'), scenario.outsideAsIs)
    const nextIndex = stepNames.indexOf(scenario.next) + 1
    assert.ok(nextIndex > 1)
    const questionTexts = await page.getByLabel(/^Pytania — pozycja \d+$/).evaluateAll((items) => items.map((item) => item.value))
    assert.match(questionTexts.join('\n'), scenario.question)
    const exceptionTexts = await page.getByLabel(/^Wyjątki — pozycja \d+$/).evaluateAll((items) => items.map((item) => item.value))
    assert.match(exceptionTexts.join('\n'), scenario.exception)
    const quotes = (await page.locator('.workshop-results blockquote').allTextContents())
      .map((text) => text.replace(/^Fragment rozmowy: /, ''))
    assert.ok(quotes.length >= stepNames.length)
    for (const quote of quotes) assert.ok(quote && transcript.includes(quote), quote)

    const approve = (index) => page.getByRole('checkbox', { name: `Sprawdzono treść — kroki, pozycja ${index}`, exact: true })
    const select = (index) => page.getByRole('checkbox', { name: `Wybierz krok ${index} do przeniesienia`, exact: true })
    const transfer = page.getByRole('button', { name: 'Przenieś wybrane kroki do AS-IS' })
    await expect(select(1)).toBeDisabled()
    await approve(1).check()
    await first.fill(scenario.corrected)
    await expect(approve(1)).not.toBeChecked()
    await expect(select(1)).toBeDisabled()
    await approve(1).check()
    await approve(nextIndex).check()
    await select(1).check()
    await select(nextIndex).check()
    await expect(transfer).toBeDisabled()
    await page.getByRole('button', { name: 'Zapisz propozycję' }).click()
    await transfer.click()
    await page.getByRole('button', { name: 'Zapisz proces AS-IS' }).click()
    await expect(page.getByText('Proces AS-IS został zapisany')).toBeVisible()

    await context.close()
    const reopened = await openWorkshop(profile)
    context = reopened.context
    page = reopened.page
    await page.getByRole('button', { name: 'Moje procesy' }).click()
    await page.locator('.process-card').filter({ hasText: scenario.name }).getByRole('button', { name: 'Otwórz proces' }).click()
    await expect(page.getByLabel('Tekst rozmowy', { exact: true })).toHaveValue(transcript)
    await expect(page.getByLabel('Kroki — pozycja 1', { exact: true })).toHaveValue(scenario.corrected)
    await expect(approve(1)).toBeChecked()
    const remaining = stepNames.findIndex((_, index) => index !== 0 && index !== nextIndex - 1) + 1
    await expect(select(remaining)).toBeDisabled()
    const persistedQuestions = await page.getByLabel(/^Pytania — pozycja \d+$/).evaluateAll((items) => items.map((item) => item.value))
    assert.deepEqual(persistedQuestions, questionTexts)
    const persistedSteps = page.locator('ol.steps-list > li')
    await expect(persistedSteps).toHaveCount(2)
    await expect(persistedSteps.nth(0)).toContainText(scenario.corrected)
    await expect(persistedSteps.nth(1)).toContainText(scenario.next)

    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('button', { name: 'Przygotuj szkic AS-IS lokalnie' }).click()
    await expect(page.getByLabel('Kroki — pozycja 1', { exact: true })).toHaveValue(scenario.corrected)
    console.log(`PASS: ${scenario.name} — ${stepNames.length} proposals with source quotes, approval, selective transfer and recovery`)
  } finally {
    try {
      await context?.close()
    } finally {
      await rm(profile, { recursive: true, force: true })
    }
  }
}

try {
  for (const scenario of scenarios) await checkScenario(scenario)
  assert.deepEqual(remoteRequests, [])
  console.log('PASS: no requests to APIs or external services')
} finally {
  await server.close()
}
