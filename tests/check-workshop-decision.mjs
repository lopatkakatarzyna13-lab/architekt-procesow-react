import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { BpmnModdle } from 'bpmn-moddle'
import { expect } from 'playwright/test'

export const decisionScenarios = [
  ['Skierowanie próbne', 'Kadry sprawdzają kompletność zgłoszenia. Jeżeli brakuje danych, kierownik uzupełnia formularz. Zgłoszenie wraca do kadr do ponownej kontroli. Gdy dane są kompletne, kadry zatwierdzają skierowanie.'],
  ['Zestawienie do biura', 'HR: Sprawdzam, czy dane są kompletne. Zwracam zestawienie menedżerowi z prośbą o uzupełnienie. Po otrzymaniu uzupełnienia ponownie sprawdzam kompletność. Gdy dane są kompletne, przekazuję zestawienie do biura.'],
]

export async function checkWorkshopDecision(page, name, transcript) {
  const button = (name) => page.getByRole('button', { name, exact: true })
  await page.getByRole('button', { name: /Dodaj kroki samodzielnie/ }).click()
  await page.getByLabel(/Nazwa procesu/).fill(name)
  await page.getByLabel(/Cel procesu/).fill('Próba decyzji i powrotu')
  await page.getByLabel(/Co rozpoczyna proces/).fill('Wpływ danych')
  await page.getByLabel(/Co kończy proces/).fill('Przekazanie kompletu')
  await button('Zapisz zakres i przejdź dalej').click()
  await page.getByLabel('Tekst rozmowy', { exact: true }).fill(transcript)
  await button('Zapisz transkrypcję').click()
  await button('Przygotuj szkic AS-IS lokalnie').click()
  for (let index = 1; index <= 4; index++) {
    await page.getByLabel('Sprawdzono treść — kroki, pozycja ' + index, { exact: true }).check()
    await page.getByLabel('Wybierz krok ' + index + ' do przeniesienia', { exact: true }).check()
  }
  await button('Zapisz propozycję').click()
  await button('Przenieś wybrane kroki do AS-IS').click()
  await button('Pomiń propozycję decyzji').click()
  await expect(button('Zatwierdź decyzję i powrót w AS-IS')).toHaveCount(0)
  await button('Wróć do pominiętej propozycji decyzji').click()
  const review = page.getByRole('region', { name: 'Propozycja decyzji AS-IS' })
  await review.getByLabel('Opis ścieżki przy brakach').fill('Braki')
  const apply = button('Zatwierdź decyzję i powrót w AS-IS')
  await apply.click()
  await expect(review.getByRole('status')).toContainText('Dodano decyzję')
  await apply.click()
  await expect(review.getByRole('status')).toContainText('już na mapie')
  await button('Zapisz proces AS-IS').click()
  await expect(page.getByText('Proces AS-IS został zapisany')).toBeVisible()
  await page.reload()
  await button('Moje procesy').click()
  await page.locator('.process-card').filter({ hasText: name }).getByRole('button', { name: 'Otwórz proces' }).click()
  await button('Pokaż podgląd BPMN').click()
  await expect(page.locator('.bpmn-preview-canvas [data-element-id="Decision_1"]').first()).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), button('Pobierz BPMN 2.0').click()])
  const path = await download.path()
  execFileSync('java', ['tests/ValidateBpmnXsd.java', 'node_modules/bpmn-moddle/resources/bpmn/xsd/BPMN20.xsd', path])
  const model = await new BpmnModdle().fromXML(await readFile(path, 'utf8'))
  assert.deepEqual(model.warnings, [])
  const node = (id) => model.rootElement.rootElements[0].flowElements.find((item) => item.id === id)
  assert.deepEqual(node('Decision_1').outgoing.map((flow) => [flow.name, flow.targetRef.id]), [['Tak', 'Task_4'], ['Braki', 'Task_2']])
  assert.equal(node('Task_3').outgoing[0].targetRef.outgoing[0].targetRef.id, 'Task_1')

  await button('Przejdź do analizy').click()
  await page.getByLabel(/Kategoria/).selectOption({ label: 'Wąskie gardło' })
  await page.getByLabel(/Nazwa problemu lub obserwacji/).fill('Powrót przy brakach')
  await button('Dodaj ustalenie').click()
  await button('Zapisz analizę').click()
  await button('Przejdź do TO-BE').click()
  await page.getByLabel(/Cel projektowanej zmiany/).fill('Skrócenie czasu korekty')
  await button('Skopiuj kroki z AS-IS').click()
  await button('Zapisz proces TO-BE').click()
  await button('Przejdź do raportu').click()
  await page.getByLabel(/Nazwa osoby, roli lub zespołu/).fill('Koordynator próby')
  await button('Dodaj interesariusza').click()
  for (const cell of await page.getByLabel(/: Koordynator próby$/).all()) await cell.selectOption('RA')
  await button('Zapisz raport').click()
  await page.evaluate(() => { window.print = () => { window.decisionReportPrinted = true } })
  await button('Eksportuj do PDF').click()
  await page.waitForFunction(() => window.decisionReportPrinted)
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ format: 'A4', printBackground: true })
  const pages = execFileSync('pdftotext', ['-', '-'], { input: pdf, encoding: 'utf8' }).split('\f')
  const diagram = pages.map((part) => part.replace(/\s+/g, ' ')).find((part) => part.includes('Mapa BPMN AS-IS'))?.split('Szczegóły kroków BPMN')[0]
  assert.ok(diagram?.includes('Braki') && diagram.includes('Tak'), 'Mapa AS-IS w PDF zawiera oba warunki')
  console.log('PASS: ' + name + ' — zatwierdzenie, wznowienie, podgląd, BPMN XSD i mapa w PDF')
}
