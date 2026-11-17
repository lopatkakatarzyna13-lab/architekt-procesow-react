// Complete fictional workshop; provider response is intercepted in the browser.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const launch = { headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) }
const browser = await chromium.launch(launch)
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
const transcript = 'HR sprawdza kompletność danych. Następnie biuro przygotowuje dokumenty. Brakuje ustalonego terminu przekazania.'
const proposal = {
  steps: [
    { text: 'Sprawdzenie kompletności danych', status: 'supported', evidence: 'HR sprawdza kompletność danych.' },
    { text: 'Przygotowanie dokumentów', status: 'supported', evidence: 'biuro przygotowuje dokumenty.' },
  ],
  roles: [{ text: 'HR', status: 'supported', evidence: 'HR' }],
  decisions: [],
  questions: [{ text: 'Jaki jest termin przekazania?', status: 'question', evidence: '' }],
}
let calls = 0
try {
  page.on('dialog', (dialog) => dialog.accept())
  await page.route('**/api/analyze-workshop', async (route) => {
    calls += 1
    assert.equal(route.request().postDataJSON().transcript, transcript)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ proposal }) })
  })
  await page.goto('http://127.0.0.1:5173/')
  await page.getByRole('button', { name: /Dodaj kroki samodzielnie/ }).click()
  await page.getByLabel(/Nazwa procesu/).fill('Fikcyjny obieg dokumentów')
  await page.getByLabel(/Cel procesu/).fill('Terminowe przygotowanie dokumentów')
  await page.getByLabel(/Co rozpoczyna proces/).fill('Wpłynięcie fikcyjnego zgłoszenia')
  await page.getByLabel(/Co kończy proces/).fill('Przekazanie dokumentów')
  await page.getByRole('button', { name: /Zapisz zakres i przejdź dalej/ }).click()
  await page.getByLabel('Tekst rozmowy').fill(transcript)
  await page.getByRole('button', { name: 'Zapisz transkrypcję' }).click()
  await page.getByRole('button', { name: 'Analizuj transkrypcję' }).click()
  assert.equal(await page.getByLabel('Kroki — pozycja 1').inputValue(), proposal.steps[0].text)
  await page.getByRole('button', { name: 'Zapisz propozycję' }).click()
  await page.getByRole('checkbox', { name: 'Wybierz krok 1 do przeniesienia' }).check()
  await page.getByRole('checkbox', { name: 'Wybierz krok 2 do przeniesienia' }).check()
  await page.getByRole('button', { name: 'Przenieś wybrane kroki do AS-IS' }).click()
  await page.getByRole('button', { name: 'Zapisz proces AS-IS' }).click()
  await page.getByText('Proces AS-IS został zapisany').waitFor()
  await page.getByRole('button', { name: /Nowy proces/ }).click()
  await page.evaluate(() => sessionStorage.setItem('architekt-procesow-screen-to-open', 'processes'))
  await page.reload()
  await page.getByRole('button', { name: 'Otwórz proces' }).click()
  assert.equal(await page.getByLabel('Tekst rozmowy').inputValue(), transcript)
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('architekt-procesow:as-is')).steps.map((step) => step.name))
  assert.deepEqual(restored, proposal.steps.map((step) => step.text))
  assert.equal(calls, 1)
  await page.getByRole('button', { name: 'Przejdź do analizy' }).click()
  await page.getByLabel(/Kategoria/).selectOption({ label: 'Wąskie gardło' })
  await page.getByLabel(/Nazwa problemu lub obserwacji/).fill('Brak terminu przekazania')
  await page.getByLabel('Wstępny pomysł usprawnienia').fill('Ustalić wspólny termin')
  await page.getByRole('button', { name: 'Dodaj ustalenie' }).click()
  await page.getByRole('button', { name: 'Zapisz analizę' }).click()
  await page.getByRole('button', { name: 'Przejdź do TO-BE' }).click()
  await page.getByLabel(/Cel projektowanej zmiany/).fill('Ustalić przewidywalny termin przekazania')
  await page.getByRole('button', { name: 'Skopiuj kroki z AS-IS' }).click()
  await page.getByRole('button', { name: 'Zapisz proces TO-BE' }).click()
  await page.getByRole('button', { name: 'Przejdź do raportu' }).click()
  await page.getByLabel(/Nazwa osoby, roli lub zespołu/).fill('Koordynator HR')
  await page.getByRole('button', { name: 'Dodaj interesariusza' }).click()
  for (const step of proposal.steps) await page.getByLabel(`${step.text}: Koordynator HR`).selectOption('RA')
  await page.getByRole('button', { name: 'Zapisz raport' }).click()
  await page.getByText('Raport procesu został zapisany').waitFor()
  const report = page.locator('.report-workspace')
  await report.getByText('Brak terminu przekazania', { exact: true }).first().waitFor()
  await report.getByText('Ustalić przewidywalny termin przekazania', { exact: true }).first().waitFor()
  for (const step of proposal.steps) await report.getByText(step.text, { exact: true }).first().waitFor()
  await page.evaluate(() => { window.__fictionalPrintCalled = false; window.print = () => { window.__fictionalPrintCalled = true } })
  await page.getByRole('button', { name: 'Eksportuj do PDF' }).click()
  await page.waitForFunction(() => window.__fictionalPrintCalled === true)
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ format: 'A4', printBackground: true, ...(process.env.FICTIONAL_PDF_PATH ? { path: process.env.FICTIONAL_PDF_PATH } : {}) })
  assert.ok(pdf.length > 1000, 'print view should render a nonempty PDF')
  const rawPdfText = execFileSync('pdftotext', ['-', '-'], { input: pdf, encoding: 'utf8' })
  const pdfText = rawPdfText.replace(/\s+/g, ' ')
  for (const expected of ['Fikcyjny obieg dokumentów', ...proposal.steps.map((step) => step.text), 'Brak terminu przekazania', 'Ustalić przewidywalny termin przekazania', 'Koordynator HR']) {
    assert.ok(pdfText.includes(expected), `PDF should include: ${expected}`)
  }
  assert.ok(rawPdfText.split('\f').some((sheet) => sheet.includes('Interesariusze procesu') && sheet.includes('Koordynator HR')), 'stakeholder heading and first item should share a page for this example')
  assert.equal(await page.locator('.print-raci-list .print-raci-r, .print-raci-list .print-raci-a').count(), 0, 'do not print empty R and A entries for an R/A assignment')
  console.log('PASS: fictional provider → review → AS-IS → save and reopen → analysis → TO-BE → RACI → report and checked PDF text')
} finally {
  await browser.close()
}
