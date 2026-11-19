import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { BpmnModdle } from 'bpmn-moddle'
import { chromium } from 'playwright'

const title = 'Miesięczne przekazanie danych do biura rachunkowego'
const manager = 'Menedżer'
const firm = 'Organizacja'
const office = 'Biuro rachunkowe'
const externalAction = 'Potwierdza otrzymanie danych'
const dataset = 'Kompletne zestawienie miesięczne'
const confirmation = 'Potwierdzenie odbioru'
const deadline = 'Menedżer przekazuje dane HR do piątego dnia miesiąca.'
const returnPath = 'Braki: HR prosi właściwego menedżera o uzupełnienie'
const decision = 'Czy zestawienie jest kompletne?'
const openQuestion = 'Jak eskalować brak odpowiedzi menedżera przed terminem?'
const steps = [
  'Menedżer przekazuje dane lub uzupełnienie do HR',
  'HR zestawia nieobecności i zatwierdzone premie',
  'HR sprawdza kompletność zestawienia',
  'HR przekazuje kompletne zestawienie do biura',
  'HR odbiera potwierdzenie od biura',
]
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 940 }, acceptDownloads: true })
  const page = await context.newPage()
  const button = (name) => page.getByRole('button', { name, exact: typeof name === 'string' })
  const label = (name) => page.getByLabel(name, { exact: typeof name === 'string' })
  const choose = (name, value) => label(name).selectOption({ label: value })
  const setQuestion = async (question) => {
    await button('Dodaj: pytania').click()
    await label('Pytania — pozycja 1').fill(question)
    await page.getByRole('checkbox', { name: 'Sprawdzono treść — pytania, pozycja 1', exact: true }).check()
    await button('Zapisz propozycję').click()
  }
  const editStep = (index) => button(/^Edytuj krok/).nth(index).click()
  const saveTaskType = async (index, type) => {
    await editStep(index)
    await choose('Typ zadania BPMN', type)
    await button('Zapisz zmiany').click()
  }
  const verifyExport = async (variant) => {
    const [download] = await Promise.all([page.waitForEvent('download'), button('Pobierz BPMN 2.0').click()])
    const path = await download.path()
    execFileSync('java', ['tests/ValidateBpmnXsd.java', 'node_modules/bpmn-moddle/resources/bpmn/xsd/BPMN20.xsd', path], { stdio: 'inherit' })
    const xml = await readFile(path, 'utf8')
    if (process.env.ACCOUNTING_BPMN_PREFIX) await writeFile(`${process.env.ACCOUNTING_BPMN_PREFIX}-${variant}.bpmn`, xml)
    const { rootElement, warnings } = await new BpmnModdle().fromXML(xml)
    assert.deepEqual(warnings, [])
    const collaboration = rootElement.rootElements.find(({ $type }) => $type === 'bpmn:Collaboration')
    assert.deepEqual(collaboration.participants.map(({ name }) => name), [firm, office])
    const [internal, external] = collaboration.participants.map(({ processRef }) => processRef.flowElements)
    const tasks = internal.filter((element) => element.$instanceOf('bpmn:Task'))
    assert.deepEqual(tasks.map(({ name }) => name), steps)
    const [supply, compile, check, send, receive] = tasks
    const sendType = variant === 'to-be' ? 'SendTask' : 'Task'
    const receiveType = variant === 'to-be' ? 'ReceiveTask' : 'Task'
    assert.equal(send.$type, `bpmn:${sendType}`)
    assert.equal(receive.$type, `bpmn:${receiveType}`)
    assert.ok(supply.documentation[0].text.split('\n').includes(`Termin wykonania: ${deadline}`))
    assert.doesNotMatch(send.documentation[0]?.text ?? '', /piątego dnia/)
    const gateway = internal.find(({ name }) => name === decision)
    assert.equal(gateway.incoming[0].sourceRef, check)
    assert.equal(gateway.outgoing.find(({ name }) => name === returnPath).targetRef.outgoing[0].targetRef, supply)
    assert.equal(supply.outgoing[0].targetRef, compile)
    assert.equal(compile.outgoing[0].targetRef, check)
    assert.equal(gateway.outgoing.find(({ name }) => name === 'Kompletne').targetRef, send)
    assert.equal(send.outgoing[0].targetRef, receive)
    assert.equal(receive.outgoing[0].targetRef.$type, 'bpmn:EndEvent')
    const externalConfirmation = external.find(({ name }) => name === externalAction)
    assert.equal(collaboration.messageFlows.length, 2)
    assert.deepEqual(collaboration.messageFlows.map(({ name, sourceRef, targetRef }) => [name, sourceRef.id, targetRef.id]), [
      [dataset, send.id, externalConfirmation.id], [confirmation, externalConfirmation.id, receive.id],
    ])
  }

  await page.goto('http://127.0.0.1:5173/')
  await button(/Tryb ekspercki/).click()
  await button(/Dodaj kroki samodzielnie/).click()
  await label(/Nazwa procesu/).fill(title)
  await label(/Cel procesu/).fill('Przekazać uzgodniony komplet danych i uzyskać potwierdzenie odbioru.')
  await label(/Co rozpoczyna proces/).fill('Menedżer przekazuje nieobecności i zatwierdzone premie.')
  await label(/Co kończy proces/).fill('Biuro rachunkowe potwierdza otrzymanie danych.')
  await button('Zapisz zakres i przejdź dalej').click()
  await button('Opracuj ręcznie').click()
  await setQuestion(openQuestion)
  for (const [index, name] of steps.entries()) {
    await label(/Nazwa kroku/).fill(name)
    await label('Osoba lub rola odpowiedzialna').fill(index === 0 ? manager : 'HR')
    await button('Dodaj krok').click()
  }
  await editStep(0)
  const details = page.getByText('Dokumenty i szczegóły wykonania', { exact: true })
  if (!await details.evaluate((element) => element.parentElement.open)) await details.click()
  await label('Termin wykonania').fill(deadline)
  await label('Wymagane dane').fill('Nieobecności i zatwierdzone premie')
  await button('Zapisz zmiany').click()
  for (const [index, name] of steps.entries()) {
    const numbered = `krok ${index + 1}: ${name}`
    await label(`Tor BPMN — ${numbered}`).fill(index === 0 ? manager : 'HR')
    await button(`Zapisz tor — ${numbered}`).click()
  }
  await choose('Od kroku', `3. ${steps[2]}`)
  await choose('Do kroku', `1. ${steps[0]}`)
  await label('Kiedy następuje przejście?').fill(returnPath)
  await button('Dodaj połączenie').click()
  await label(`Pytanie decyzji — ${steps[2]}`).fill(decision)
  await label(`Kiedy kontynuować podstawową ścieżkę — ${steps[2]}`).fill('Kompletne')
  await button(`Zapisz decyzję BPMN — ${steps[2]}`).click()
  await label('Nazwa działania').fill(externalAction)
  await button('Dodaj działanie zewnętrzne').click()
  for (const [index, direction, name] of [[3, 'outgoing', dataset], [4, 'incoming', confirmation]]) {
    await choose('Krok w Twoim procesie', `${index + 1}. ${steps[index]}`)
    await label('Nazwa basenu Twojego procesu').fill(firm)
    await label('Nazwa basenu zewnętrznego').fill(office)
    await label('Kierunek wiadomości').selectOption(direction)
    await choose('Działanie uczestnika zewnętrznego (opcjonalnie)', externalAction)
    await label('Co jest przekazywane?').fill(name)
    await button('Dodaj wiadomość BPMN').click()
  }
  await button('Zapisz proces AS-IS').click()
  await verifyExport('as-is')
  await button('Przejdź do analizy').click()
  await choose(/Kategoria/, 'Wąskie gardło')
  await label(/Nazwa problemu lub obserwacji/).fill('Braki wymagają ponownej kontroli')
  await choose('Gdzie występuje?', `3. ${steps[2]}`)
  await label('Opis obecnej sytuacji').fill('HR czeka na uzupełnienie i ponownie sprawdza zestawienie.')
  await label('Wstępny pomysł usprawnienia').fill('Po wysłaniu zapisać status oczekiwania na potwierdzenie odbioru.')
  await button('Dodaj ustalenie').click()
  await button('Zapisz analizę').click()
  await button('Przejdź do TO-BE').click()
  await label(/Cel projektowanej zmiany/).fill('Rozróżnić wysłanie zestawienia i uzyskanie potwierdzenia odbioru.')
  await button('Skopiuj mapę BPMN z AS-IS').click()
  await saveTaskType(3, 'Wysyła wiadomość')
  await saveTaskType(4, 'Czeka na wiadomość')
  await button('Zapisz proces TO-BE').click()
  await verifyExport('to-be')
  await button('Pokaż podgląd BPMN').click()
  await page.locator('.bpmn-preview-canvas [data-element-id="ExternalTask_1"]').waitFor()
  await button('Przejdź do raportu').click()
  for (const [index, step] of steps.entries()) await label(`${step}: ${index === 0 ? manager : 'HR'}`).selectOption('RA')
  await button('Zapisz raport').click()
  await page.getByRole('checkbox', { name: openQuestion, exact: true }).check()
  await page.evaluate(() => { window.print = () => { window.accountingPrinted = true } })
  await button('Eksportuj do PDF').click()
  await page.waitForFunction(() => window.accountingPrinted)
  await page.emulateMedia({ media: 'print' })
  const path = process.env.ACCOUNTING_PDF_PATH
  const pdf = await page.pdf({ format: 'A4', printBackground: true, ...(path ? { path } : {}) })
  const pages = execFileSync('pdftotext', ['-', '-'], { input: pdf, encoding: 'utf8' }).split('\f').map((text) => text.replace(/\s+/g, ' '))
  const text = pages.join(' ')
  for (const expected of [title, deadline, returnPath, externalAction, confirmation, openQuestion, 'Wysyła wiadomość', 'Czeka na wiadomość']) {
    assert.ok(text.includes(expected), `PDF missing: ${expected}`)
  }
  for (const variant of ['AS-IS', 'TO-BE']) {
    assert.ok(pages.find((page) => page.includes(`Mapa BPMN ${variant}`))?.includes(office), `Missing pool on PDF map ${variant}`)
  }
  console.log('PASS: accounting handoff round-trips through AS-IS, TO-BE, BPMN 2.0 and PDF')
} finally {
  await browser.close()
}
