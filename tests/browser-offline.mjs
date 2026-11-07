import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
const page = await context.newPage()
const transcript = 'HR sprawdza kompletność danych, następnie przekazuje komplet do biura.'
const expectedSteps = ['Sprawdzenie kompletności danych', 'Przekazanie danych do biura']

try {
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Dodaj kroki samodzielnie/ }).click()
  await page.getByLabel(/Nazwa procesu/).fill('Warsztat fikcyjny offline')
  await page.getByLabel(/Cel procesu/).fill('Przygotowanie dokumentów')
  await page.getByLabel(/Co rozpoczyna proces/).fill('Wpłynięcie wniosku')
  await page.getByLabel(/Co kończy proces/).fill('Przekazanie danych do biura')
  await page.getByRole('button', { name: /Zapisz zakres i przejdź dalej/ }).click()
  await page.getByLabel('Tekst rozmowy').waitFor()

  // Simulate losing internet AFTER the application has loaded.
  await context.setOffline(true)
  assert.equal(await page.evaluate(() => navigator.onLine), false)
  await page.getByLabel('Tekst rozmowy').fill(transcript)
  await page.getByRole('button', { name: 'Zapisz transkrypcję' }).click()
  await page.getByText('Transkrypcja zapisana na tym urządzeniu.').waitFor()
  await page.getByRole('button', { name: 'Opracuj ręcznie' }).click()
  await page.getByRole('button', { name: 'Dodaj: kroki' }).click()
  await page.getByLabel('Kroki — pozycja 1').fill(expectedSteps[0])
  await page.getByRole('button', { name: 'Dodaj: kroki' }).click()
  await page.getByLabel('Kroki — pozycja 2').fill(expectedSteps[1])
  await page.getByRole('button', { name: 'Zapisz propozycję' }).click()
  await page.getByText('Propozycja zapisana na tym urządzeniu.').waitFor()
  await page.getByRole('checkbox', { name: 'Wybierz krok 1 do przeniesienia' }).check()
  await page.getByRole('checkbox', { name: 'Wybierz krok 2 do przeniesienia' }).check()
  await page.getByRole('button', { name: 'Przenieś wybrane kroki do AS-IS' }).click()
  await page.getByRole('button', { name: 'Zapisz proces AS-IS' }).click()
  await page.getByText('Proces AS-IS został zapisany').waitFor()

  const saved = await page.evaluate(() => ({
    identity: localStorage.getItem('architekt-procesow:current-process-id'),
    asIs: JSON.parse(localStorage.getItem('architekt-procesow:as-is')),
    workshopKeys: Object.keys(localStorage).filter((key) => key.startsWith('architekt-procesow:workshop:')),
  }))
  assert.deepEqual(saved.asIs.steps.map(({ name }) => name), expectedSteps)
  assert.ok(saved.asIs.savedAt, 'AS-IS must be explicitly saved')
  assert.equal(saved.workshopKeys.length, 2, 'transcript and review must be persisted')
  console.log('PASS: with the page loaded, the manual workshop and AS-IS save work during lost connectivity')

  // Test AI failure, without making any real provider request or using client data.
  await page.getByRole('button', { name: 'Analizuj transkrypcję' }).click()
  await page.getByText('Serwer analizy jest niedostępny. Sprawdź konfigurację.').waitFor()
  console.log('PASS: AI network failure is reported without discarding saved AS-IS')

  // A full offline restart is NOT covered: the project has no installed offline application cache.
  await context.setOffline(false)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByLabel('Tekst rozmowy').waitFor()
  assert.equal(await page.getByLabel('Tekst rozmowy').inputValue(), transcript)
  const restoredSteps = await page.locator('ol.steps-list li .step-details strong').allTextContents()
  assert.deepEqual(restoredSteps, expectedSteps)
  console.log('PASS: after reconnecting and reloading, the saved workshop and AS-IS steps are restored')
} catch (error) {
  console.error('Browser test failed:', error)
  await page.screenshot({ path: '/tmp/architekt-browser-error.png', fullPage: true }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
