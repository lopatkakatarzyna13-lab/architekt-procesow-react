import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { BpmnModdle } from 'bpmn-moddle'
import { expect } from 'playwright/test'

export const decisionScenarios = [
  ['Skierowanie próbne', 'Kadry sprawdzają kompletność zgłoszenia. Jeżeli brakuje danych, kierownik uzupełnia formularz. Zgłoszenie wraca do kadr do ponownej kontroli. Gdy dane są kompletne, kadry zatwierdzają skierowanie. Pracownik odbiera skierowanie na badania wstępne w formacie PDF przez portal.'],
  ['Zestawienie do biura', 'HR: Sprawdzam, czy dane są kompletne. Zwracam zestawienie menedżerowi z prośbą o uzupełnienie. Po otrzymaniu uzupełnienia ponownie sprawdzam kompletność. Gdy dane są kompletne, przekazuję zestawienie nieobecności w formacie XLSX do biura rachunkowego e-mailem.'],
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
  const referral = name === 'Skierowanie próbne'
  const owners = referral ? ['Kadry', 'Kierownik', 'Kadry', 'Kadry', 'Pracownik'] : ['HR', 'HR', 'HR', 'HR']
  const expectedDoc = referral
    ? { name: 'Skierowanie na badania wstępne', direction: 'input', format: 'PDF', channel: 'portal', corrected: 'Skierowanie wstępne' }
    : { name: 'Zestawienie nieobecności', direction: 'output', format: 'XLSX', channel: 'e-mail', corrected: 'Raport nieobecności' }
  for (let index = 1; index <= owners.length; index++) {
    await page.getByLabel('Wykonawca — krok ' + index, { exact: true }).fill(owners[index - 1])
    await page.getByLabel('Sprawdzono treść — kroki, pozycja ' + index, { exact: true }).check()
    await page.getByLabel('Wybierz krok ' + index + ' do przeniesienia', { exact: true }).check()
  }
  await button('Zapisz propozycję').click()
  await button('Przenieś wybrane kroki do AS-IS').click()
  const documents = page.getByRole('region', { name: 'Dokumenty z transkrypcji' })
  await expect(documents.getByLabel('Nazwa dokumentu')).toHaveValue(expectedDoc.name)
  await expect(documents.getByLabel('Kierunek dokumentu')).toHaveValue(expectedDoc.direction)
  await expect(documents.getByLabel('Format', { exact: true })).toHaveValue(expectedDoc.format)
  await expect(documents.getByLabel('Kanał przekazania')).toHaveValue(expectedDoc.channel)
  await documents.getByLabel('Nazwa dokumentu').fill(expectedDoc.corrected)
  await button('Zatwierdź dokument na mapie AS-IS').click()
  await expect(documents.getByRole('status')).toContainText(expectedDoc.corrected)
  const prepareHandoff = button('Przygotuj przekazanie do innego basenu')
  const external = page.getByLabel('Nazwa basenu zewnętrznego', { exact: true })
  const partner = referral ? 'Agencja zatrudnienia' : 'Biuro rachunkowe'
  await prepareHandoff.click()
  await expect(page.getByLabel('Co jest przekazywane?')).toHaveValue(expectedDoc.corrected)
  await expect(page.getByLabel('Kierunek wiadomości')).toHaveValue(referral ? 'incoming' : 'outgoing')
  await expect(external).toHaveValue(referral ? '' : partner)
  if (referral) {
    await button('Dodaj wiadomość BPMN').click()
    await expect(external).toBeFocused()
    await external.fill(partner)
  }
  await prepareHandoff.click()
  await expect(external).toHaveValue(partner)
  await button('Dodaj wiadomość BPMN').click()
  await expect(button('Wyczyść formularz wiadomości')).toHaveCount(0)
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
  const batch = button('Zatwierdź tory według wykonawców')
  const firstLane = page.getByLabel(/^Tor BPMN — krok 1:/)
  await firstLane.fill('Niezapisana korekta')
  await expect(batch).toBeDisabled()
  await firstLane.fill('')
  await expect(batch).toBeEnabled()
  await batch.click()
  for (const [index, owner] of owners.entries()) {
    await expect(page.getByLabel(new RegExp('^Tor BPMN — krok ' + (index + 1) + ':'))).toHaveValue(owner)
  }
  await button('Zapisz proces AS-IS').click()
  await expect(page.getByText('Proces AS-IS został zapisany')).toBeVisible()
  await page.reload()
  await button('Moje procesy').click()
  await page.locator('.process-card').filter({ hasText: name }).getByRole('button', { name: 'Otwórz proces' }).click()
  await expect(documents.getByRole('status')).toContainText(expectedDoc.corrected)
  await button('Pokaż podgląd BPMN').click()
  await expect(page.locator('.bpmn-preview-canvas [data-element-id="Decision_1"]').first()).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), button('Pobierz BPMN 2.0').click()])
  const path = await download.path()
  execFileSync('java', ['tests/ValidateBpmnXsd.java', 'node_modules/bpmn-moddle/resources/bpmn/xsd/BPMN20.xsd', path])
  const model = await new BpmnModdle().fromXML(await readFile(path, 'utf8'))
  assert.deepEqual(model.warnings, [])
  const node = (id) => model.rootElement.rootElements[0].flowElements.find((item) => item.id === id)
  function verifyLanes(root) {
    const process = root.rootElements.find((element) => element.$type === 'bpmn:Process')
    const task = process.flowElements.find((item) => item.id === 'Task_' + owners.length)
    const associations = task.get(referral ? 'dataInputAssociations' : 'dataOutputAssociations')
    assert.equal(associations.length, 1)
    const ref = referral ? associations[0].sourceRef[0] : associations[0].targetRef
    assert.equal(ref.name, expectedDoc.corrected)
    assert.equal(ref.documentation[0].text, 'Format: ' + expectedDoc.format + '\nKanał przekazania: ' + expectedDoc.channel)
    const lanes = process.laneSets[0].lanes
    assert.deepEqual(lanes.map((lane) => lane.name), [...new Set(owners)])
    owners.forEach((owner, index) => {
      assert.ok(lanes.find((lane) => lane.name === owner).flowNodeRef.some((ref) => ref.id === 'Task_' + (index + 1)))
    })
  }
  function verifyHandoff(root) {
    const collaboration = root.rootElements.find((element) => element.$type === 'bpmn:Collaboration')
    assert.equal(collaboration.messageFlows.length, 1)
    const externalPool = collaboration.participants.find((participant) => participant.name === partner)
    assert.ok(externalPool)
    const flow = collaboration.messageFlows[0]
    assert.equal(flow.name, expectedDoc.corrected)
    assert.equal(referral ? flow.sourceRef : flow.targetRef, externalPool)
    assert.equal((referral ? flow.targetRef : flow.sourceRef).id, 'Task_' + owners.length)
  }
  verifyHandoff(model.rootElement)
  verifyLanes(model.rootElement)
  assert.deepEqual(node('Decision_1').outgoing.map((flow) => [flow.name, flow.targetRef.id]), [['Tak', 'Task_4'], ['Braki', 'Task_2']])
  assert.equal(node('Task_3').outgoing[0].targetRef.outgoing[0].targetRef.id, 'Task_1')

  await button('Przejdź do analizy').click()
  await page.getByLabel(/Kategoria/).selectOption({ label: 'Wąskie gardło' })
  await page.getByLabel(/Nazwa problemu lub obserwacji/).fill('Powrót przy brakach')
  await button('Dodaj ustalenie').click()
  await button('Zapisz analizę').click()
  await button('Przejdź do TO-BE').click()
  await page.getByLabel(/Cel projektowanej zmiany/).fill('Skrócenie czasu korekty')
  if (referral) await button('Skopiuj mapę BPMN z AS-IS').click()
  else {
    await button('Skopiuj kroki z AS-IS').click()
    await button('Zatwierdź tory według wykonawców').click()
  }
  await button('Zapisz proces TO-BE').click()
  const [targetDownload] = await Promise.all([page.waitForEvent('download'), button('Pobierz BPMN 2.0').click()])
  const targetPath = await targetDownload.path()
  execFileSync('java', ['tests/ValidateBpmnXsd.java', 'node_modules/bpmn-moddle/resources/bpmn/xsd/BPMN20.xsd', targetPath])
  const targetRoot = (await new BpmnModdle().fromXML(await readFile(targetPath, 'utf8'))).rootElement
  verifyLanes(targetRoot)
  if (referral) verifyHandoff(targetRoot)
  await button('Przejdź do raportu').click()
  await page.getByLabel(/Nazwa osoby, roli lub zespołu/).fill('Koordynator próby')
  await button('Dodaj interesariusza').click()
  for (const cell of await page.getByLabel(/: Koordynator próby$/).all()) await cell.selectOption('RA')
  await button('Zapisz raport').click()
  await page.evaluate(() => { window.print = () => { window.decisionReportPrinted = true } })
  await button('Eksportuj do PDF').click()
  await page.waitForFunction(() => window.decisionReportPrinted)
  const printedHandoff = await page.locator('.print-bpmn-image:not(.print-tobe-bpmn)').evaluate((image) => {
    const svg = new DOMParser().parseFromString(decodeURIComponent(image.src.split(',')[1]), 'image/svg+xml')
    return Boolean(svg.querySelector('[data-element-id="MessageFlow_1"]'))
  })
  assert.ok(printedHandoff, 'Mapa AS-IS do druku zawiera przepływ wiadomości')
  for (const selector of ['.print-bpmn-image:not(.print-tobe-bpmn)', '.print-tobe-bpmn']) {
    const labels = await page.locator(selector).evaluate((image) => {
      const svg = new DOMParser().parseFromString(decodeURIComponent(image.src.split(',')[1]), 'image/svg+xml')
      return [...svg.querySelectorAll('[data-element-id^="Lane_"] text')].map((el) => el.textContent.trim())
    })
    for (const owner of owners) assert.ok(labels.includes(owner), 'Tor w mapie do druku: ' + owner)
  }
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ format: 'A4', printBackground: true })
  const pages = execFileSync('pdftotext', ['-', '-'], { input: pdf, encoding: 'utf8' }).split('\f')
  assert.ok(pages.join(' ').replace(/\s+/g, ' ').includes(expectedDoc.corrected), 'Zatwierdzona nazwa dokumentu w PDF')
  assert.ok(pages.join(' ').replace(/\s+/g, ' ').includes(partner), 'Uczestnik przekazania w PDF')
  const diagram = pages.map((part) => part.replace(/\s+/g, ' ')).find((part) => part.includes('Mapa BPMN AS-IS'))?.split('Szczegóły kroków BPMN')[0]
  assert.ok(diagram?.includes('Braki') && diagram.includes('Tak'), 'Mapa AS-IS w PDF zawiera oba warunki')
  console.log('PASS: ' + name + ' — dokument i przekazanie ' + (referral ? 'przychodzące' : 'wychodzące') + ', basen, właściwy krok, BPMN XSD i PDF')
}
