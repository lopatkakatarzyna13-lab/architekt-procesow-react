import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { BpmnModdle } from 'bpmn-moddle'
import { chromium } from 'playwright'

const title = 'Korekta danych pracownika'
const firm = 'Organizacja'
const employee = 'Pracownik'
const operator = 'HR – korekta'
const reviewer = 'HR – kontrola'
const document = 'Dokument potwierdzający zmianę'
const openQuestions = [
  'Czy korekta trafia automatycznie do innych systemów?',
  'Co zrobić, jeśli pracownik nie dostarczy dokumentu?',
]
const steps = [
  'HR sprawdza zgłoszenie i dostępność dokumentu',
  'HR prosi pracownika o dokument',
  'HR oczekuje na dokument',
  'HR zmienia dane w systemie kadrowym',
  'Druga osoba z HR kontroluje korektę',
  'HR informuje pracownika o zakończeniu sprawy',
]
const decisions = [
  { from: 0, to: 3, question: 'Czy jest dokument potwierdzający?', main: 'Brak dokumentu', alternate: 'Dokument jest dostępny' },
  { from: 4, to: 3, question: 'Czy korekta jest poprawna?', main: 'Korekta poprawna', alternate: 'Błąd – wróć do korekty' },
]
const messages = [
  [0, 'incoming', 'Zgłoszenie korekty'],
  [1, 'outgoing', 'Prośba o dokument'],
  [2, 'incoming', document],
  [5, 'outgoing', 'Informacja o zakończeniu'],
]
const owner = (index) => index === 4 ? reviewer : operator
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 940 }, acceptDownloads: true })
  const page = await context.newPage()
  const button = (name) => page.getByRole('button', { name, exact: typeof name === 'string' })
  const label = (name) => page.getByLabel(name, { exact: typeof name === 'string' })
  const choose = (name, value) => label(name).selectOption({ label: value })
  const editStep = (index) => button(/^Edytuj krok/).nth(index).click()
  const saveTaskType = async (index, type) => {
    await editStep(index)
    await choose('Typ zadania BPMN', type)
    await button('Zapisz zmiany').click()
  }
  const downloadBpmn = async (expectedFilename, control = button('Pobierz BPMN 2.0')) => {
    const [download] = await Promise.all([page.waitForEvent('download'), control.click()])
    if (expectedFilename) assert.equal(download.suggestedFilename(), expectedFilename)
    const path = await download.path()
    execFileSync('java', ['tests/ValidateBpmnXsd.java', 'node_modules/bpmn-moddle/resources/bpmn/xsd/BPMN20.xsd', path], { stdio: 'inherit' })
    return readFile(path, 'utf8')
  }
  const verifyExport = async (variant) => {
    const xml = await downloadBpmn()
    if (process.env.CORRECTION_BPMN_PREFIX) await writeFile(`${process.env.CORRECTION_BPMN_PREFIX}-${variant}.bpmn`, xml)
    const { rootElement, warnings } = await new BpmnModdle().fromXML(xml)
    assert.deepEqual(warnings, [])
    const collaboration = rootElement.rootElements.find(({ $type }) => $type === 'bpmn:Collaboration')
    assert.deepEqual(collaboration.participants.map(({ name }) => name), [firm, employee])
    const model = collaboration.participants[0].processRef
    const tasks = model.flowElements.filter((element) => element.$instanceOf('bpmn:Task'))
    assert.deepEqual(tasks.map(({ name }) => name), steps)
    const [, request, wait, correct, check, close] = tasks
    const lanes = model.laneSets[0].lanes
    assert.deepEqual(lanes.map(({ name }) => name), [operator, reviewer])
    assert.ok(lanes[0].flowNodeRef.includes(correct))
    assert.ok(lanes[1].flowNodeRef.includes(check))
    assert.equal(wait.$type, variant === 'to-be' ? 'bpmn:ReceiveTask' : 'bpmn:Task')
    const merge = model.flowElements.find(({ id }) => id === 'Merge_4')
    assert.equal(merge.outgoing[0].targetRef, correct)
    assert.equal(correct.outgoing[0].targetRef, check)
    assert.equal(request.outgoing[0].targetRef, wait)
    assert.equal(wait.outgoing[0].targetRef, merge)
    for (const { from, question, main, alternate } of decisions) {
      const gateway = model.flowElements.find(({ name }) => name === question)
      assert.equal(gateway.incoming[0].sourceRef, tasks[from])
      assert.equal(gateway.outgoing.find(({ name }) => name === alternate).targetRef, merge)
      assert.equal(gateway.outgoing.find(({ name }) => name === main).targetRef, tasks[from + 1])
    }
    const diagram = rootElement.diagrams[0].plane.planeElement
    const approaches = diagram.filter(({ bpmnElement }) => decisions.some(({ alternate }) => alternate === bpmnElement?.name))
    assert.equal(approaches.length, 2)
    assert.notEqual(approaches[0].waypoint.at(-1).x, approaches[1].waypoint.at(-1).x)
    assert.deepEqual(collaboration.messageFlows.map(({ name, sourceRef, targetRef }) => [name, sourceRef.id, targetRef.id]),
      messages.map(([index, direction, name]) => direction === 'incoming'
        ? [name, 'Participant_External_1', tasks[index].id]
        : [name, tasks[index].id, 'Participant_External_1']))
    assert.equal(close.outgoing[0].targetRef.$type, 'bpmn:EndEvent')
    return xml
  }

  await page.goto('http://127.0.0.1:5173/')
  await button(/Tryb ekspercki/).click()
  await button(/Dodaj kroki samodzielnie/).click()
  await label(/Nazwa procesu/).fill(title)
  await label(/Cel procesu/).fill('Skorygować dane kadrowe i potwierdzić to pracownikowi.')
  await label(/Co rozpoczyna proces/).fill('Pracownik zgłasza błąd w danych.')
  await label(/Co kończy proces/).fill('HR informuje pracownika po poprawnej kontroli.')
  await button('Zapisz zakres i przejdź dalej').click()
  await button('Opracuj ręcznie').click()
  for (const [index, question] of openQuestions.entries()) {
    await button('Dodaj: pytania').click()
    await label(`Pytania — pozycja ${index + 1}`).fill(question)
    await page.getByRole('checkbox', { name: `Sprawdzono treść — pytania, pozycja ${index + 1}`, exact: true }).check()
  }
  await button('Zapisz propozycję').click()
  for (const [index, name] of steps.entries()) {
    await label(/Nazwa kroku/).fill(name)
    await label('Osoba lub rola odpowiedzialna').fill(owner(index))
    await button('Dodaj krok').click()
  }

  for (const [index, name] of steps.entries()) {
    const numbered = `krok ${index + 1}: ${name}`
    await label(`Tor BPMN — ${numbered}`).fill(owner(index))
    await button(`Zapisz tor — ${numbered}`).click()
  }
  for (const { from, to, main, alternate, question } of decisions) {
    await choose('Od kroku', `${from + 1}. ${steps[from]}`)
    await choose('Do kroku', `${to + 1}. ${steps[to]}`)
    await label('Kiedy następuje przejście?').fill(alternate)
    await button('Dodaj połączenie').click()
    await label(`Pytanie decyzji — ${steps[from]}`).fill(question)
    await label(`Kiedy kontynuować podstawową ścieżkę — ${steps[from]}`).fill(main)
    await button(`Zapisz decyzję BPMN — ${steps[from]}`).click()
  }
  for (const [index, direction, name] of messages) {
    await choose('Krok w Twoim procesie', `${index + 1}. ${steps[index]}`)
    await label('Nazwa basenu Twojego procesu').fill(firm)
    await label('Nazwa basenu zewnętrznego').fill(employee)
    await label('Kierunek wiadomości').selectOption(direction)
    await label('Co jest przekazywane?').fill(name)
    await button('Dodaj wiadomość BPMN').click()
  }
  await button('Zapisz proces AS-IS').click()
  const savedAsIs = await verifyExport('as-is')
  await button('Przejdź do analizy').click()
  await choose(/Kategoria/, 'Wąskie gardło')
  await label(/Nazwa problemu lub obserwacji/).fill('Błąd korekty wymaga ponownej kontroli')
  await choose('Gdzie występuje?', `5. ${steps[4]}`)
  await label('Opis obecnej sytuacji').fill('Druga osoba z HR odsyła korektę do poprawy.')
  await label('Wstępny pomysł usprawnienia').fill('Oznaczyć krok oczekiwania na dokument od pracownika.')
  await button('Dodaj ustalenie').click()
  await button('Zapisz analizę').click()
  await button('Przejdź do TO-BE').click()
  await label(/Cel projektowanej zmiany/).fill('Pokazać oczekiwanie na dokument i odrębną kontrolę korekty.')
  await button('Skopiuj mapę BPMN z AS-IS').click()
  await saveTaskType(2, 'Czeka na wiadomość')
  await button('Zapisz proces TO-BE').click()
  const savedToBe = await verifyExport('to-be')
  await button('Pokaż podgląd BPMN').click()
  await page.locator('.bpmn-preview-canvas [data-element-id="Participant_External_1"]').waitFor()
  await button('Przejdź do raportu').click()
  for (const [index, step] of steps.entries()) await label(`${step}: ${owner(index)}`).selectOption('RA')
  await button('Zapisz raport').click()
  for (const question of openQuestions) await page.getByRole('checkbox', { name: question, exact: true }).check()
  await page.evaluate(() => { window.print = () => { window.correctionPrinted = true } })
  await button('Eksportuj do PDF').click()
  await page.waitForFunction(() => window.correctionPrinted)
  await page.emulateMedia({ media: 'print' })
  const path = process.env.CORRECTION_PDF_PATH
  const pdf = await page.pdf({ format: 'A4', printBackground: true, ...(path ? { path } : {}) })
  const pages = execFileSync('pdftotext', ['-', '-'], { input: pdf, encoding: 'utf8' }).split('\f').map((text) => text.replace(/\s+/g, ' '))
  const text = pages.join(' ')
  for (const expected of [title, document, ...decisions.map(({ alternate }) => alternate), ...openQuestions, 'Czeka na wiadomość']) {
    assert.ok(text.includes(expected), `PDF missing: ${expected}`)
  }
  for (const variant of ['AS-IS', 'TO-BE']) {
    assert.ok(pages.find((page) => page.includes(`Mapa BPMN ${variant}`))?.includes(employee), `Missing pool on PDF map ${variant}`)
  }
  await page.emulateMedia({ media: 'screen' })
  await button('Zakończ wersję').click()
  await page.reload()
  await button('Moje procesy').click()
  const completed = page.locator('.process-card').filter({ hasText: 'Wersja 1 · Zakończona' })
  await completed.getByRole('button', { name: 'Otwórz proces', exact: true }).click()
  assert.equal(await button('Zapisz raport').count(), 0)
  const materials = page.getByRole('region', { name: 'Materiały do wdrożenia' })
  for (const [variant, expected] of [['TO-BE', savedToBe], ['AS-IS', savedAsIs]]) {
    await button(`Mapa ${variant}`).click()
    await button('Pokaż podgląd BPMN').click()
    await page.getByRole('img', { name: `Podgląd zapisanego diagramu BPMN ${variant}` })
      .locator('[data-element-id="Participant_External_1"]').waitFor()
    const download = materials.getByRole('button', { name: `Pobierz ${variant} BPMN`, exact: true })
    assert.equal(await downloadBpmn(`korekta-danych-pracownika-v1-${variant.toLowerCase()}.bpmn`, download), expected)
  }
  await page.evaluate(() => {
    window.print = () => {
      window.completedPrintTitle = document.title
      window.dispatchEvent(new Event('afterprint'))
    }
  })
  await button('Eksportuj do PDF').click()
  await page.waitForFunction(() => window.completedPrintTitle)
  assert.equal(await page.evaluate(() => window.completedPrintTitle), 'korekta-danych-pracownika-v1-raport')
  await page.emulateMedia({ media: 'print' })
  const completedPdf = await page.pdf({ format: 'A4', printBackground: true })
  assert.match(execFileSync('pdftotext', ['-', '-'], { input: completedPdf, encoding: 'utf8' }), /Wersja procesu 1/)
  console.log('PASS: completed report reopens with previews and the original BPMN downloads')
  console.log('PASS: employee data correction round-trips through AS-IS, TO-BE, BPMN 2.0 and PDF')
} finally {
  await browser.close()
}
