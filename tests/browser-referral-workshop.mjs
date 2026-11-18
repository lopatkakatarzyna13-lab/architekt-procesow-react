import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { BpmnModdle } from 'bpmn-moddle'
import { chromium } from 'playwright'

const branched = process.env.REFERRAL_WITH_POOLS === '1'
const title = branched ? 'Skierowanie na badania wstępne – decyzja i baseny' : 'Skierowanie na badania wstępne – próba'
const managerTask = 'Kierownik przekazuje zgłoszenie lub uzupełnia dane stanowiska'
const managerFormTask = 'Kierownik przekazuje zgłoszenie lub uzupełnia dane w formularzu'
const manager = 'Kierownik'
const organization = 'Organizacja'
const recipient = 'Osoba przyjmowana'
const decision = 'Czy dane są kompletne?'
const returnPath = 'Nie: HR prosi kierownika o uzupełnienie'
const message = 'Skierowanie na badania wstępne'
const asIs = [
  ...(branched ? [managerTask] : []),
  'HR sprawdza, czy kierownik podał stanowisko i opisał warunki pracy',
  'HR przygotowuje skierowanie po otrzymaniu kompletu informacji.',
  'HR wysyła skierowanie mailem do osoby przyjmowanej.',
]
const checkIndex = branched ? 1 : 0
const toBe = [
  ...(branched ? [managerFormTask] : []),
  'HR weryfikuje zgłoszenie przesłane przez formularz',
  ...asIs.slice(checkIndex + 1),
]
const issue = 'Brak opisu warunków pracy wydłuża przygotowanie skierowania.'
const exception = 'Gdy brakuje opisu warunków pracy, HR prosi kierownika o uzupełnienie i czeka na odpowiedź.'
const improvement = 'Kierownik zgłasza nową osobę na formularzu z obowiązkowym polem „Warunki pracy”.'
const question = 'Kto wysyła skierowanie podczas nieobecności koordynatorki HR?'
const assignee = 'Koordynatorka HR'
const output = process.env.REFERRAL_PDF_PATH
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
})

try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  let page = await context.newPage()
  const button = (name) => page.getByRole('button', { name, exact: true })
  const label = (name) => page.getByLabel(name, { exact: typeof name === 'string' })
  const choose = (name, value) => label(name).selectOption({ label: value })
  const check = (name) => page.getByRole('checkbox', { name, exact: true }).check()
  const open = () => page.goto('http://127.0.0.1:5173/')

  const verifyModel = async (firstTask, checkTask, label) => {
    const [download] = await Promise.all([page.waitForEvent('download'), button('Pobierz BPMN 2.0').click()])
    const path = await download.path()
    execFileSync('java', ['tests/ValidateBpmnXsd.java', 'node_modules/bpmn-moddle/resources/bpmn/xsd/BPMN20.xsd', path], { stdio: 'inherit' })
    const { rootElement, warnings } = await new BpmnModdle().fromXML(await readFile(path, 'utf8'))
    assert.deepEqual(warnings, [], label)
    const collaboration = rootElement.rootElements.find((item) => item.$type === 'bpmn:Collaboration')
    assert.deepEqual(collaboration.participants.map((item) => item.name), [organization, recipient])
    const process = collaboration.participants[0].processRef
    const tasks = process.flowElements.filter((item) => item.$type === 'bpmn:Task')
    const lanes = process.laneSets[0].lanes
    const start = process.flowElements.find((item) => item.$type === 'bpmn:StartEvent')
    assert.deepEqual(lanes.map((lane) => lane.name), [manager, 'HR'])
    assert.ok(lanes[0].flowNodeRef.includes(start))
    assert.equal(tasks[0].name, firstTask)
    assert.ok(lanes[0].flowNodeRef.includes(tasks[0]))
    assert.ok(lanes[1].flowNodeRef.includes(tasks[1]))
    assert.equal(tasks[1].name, checkTask)
    const gateway = process.flowElements.find((item) => item.name === decision)
    assert.equal(gateway.incoming[0].sourceRef, tasks[1])
    const yes = gateway.outgoing.find((item) => item.name === 'Tak')
    const no = gateway.outgoing.find((item) => item.name === returnPath)
    assert.equal(yes.targetRef, tasks[2])
    assert.equal(no.targetRef, start.outgoing[0].targetRef)
    assert.equal(no.targetRef.outgoing[0].targetRef, tasks[0])
    assert.equal(tasks[0].outgoing[0].targetRef, tasks[1])
    assert.equal(collaboration.messageFlows.length, 1)
    const handoff = collaboration.messageFlows[0]
    assert.equal(handoff.name, message)
    assert.equal(handoff.sourceRef, tasks.at(-1))
    assert.equal(handoff.targetRef, collaboration.participants[1])
  }

  await open()
  await page.getByRole('button', { name: /Tryb ekspercki/ }).click()
  await page.getByRole('button', { name: /Dodaj kroki samodzielnie/ }).click()
  await label(/Nazwa procesu/).fill(title)
  await label(/Cel procesu/).fill('Przekazać osobie przyjmowanej kompletne skierowanie, aby mogła umówić badania wstępne.')
  await label(/Co rozpoczyna proces/).fill(branched
    ? 'Kierownik potwierdza przyjęcie nowej osoby.'
    : 'HR otrzymuje od kierownika potwierdzenie przyjęcia nowej osoby.')
  await label(/Co kończy proces/).fill('HR przekazuje skierowanie osobie przyjmowanej.')
  await button('Zapisz zakres i przejdź dalej').click()
  await button('Opracuj ręcznie').click()
  for (const [index, step] of asIs.entries()) {
    await button('Dodaj: kroki').click()
    await label(`Kroki — pozycja ${index + 1}`).fill(step)
    await check(`Sprawdzono treść — kroki, pozycja ${index + 1}`)
  }
  await button('Dodaj: wyjątki').click()
  await label('Wyjątki — pozycja 1').fill(exception)
  await check('Sprawdzono treść — wyjątki, pozycja 1')
  await button('Dodaj: pytania').click()
  await label('Pytania — pozycja 1').fill(question)
  await check('Sprawdzono treść — pytania, pozycja 1')
  await label('Kto wróci z odpowiedzią — pytanie 1').fill(assignee)
  await label('Termin odpowiedzi — pytanie 1').fill('2026-11-20')

  // Keep localStorage, but discard the whole tab, including its sessionStorage.
  await page.close()
  page = await context.newPage()
  page.on('dialog', (dialog) => dialog.accept())
  await open()
  await button('Moje procesy').click()
  const savedDraft = page.locator('.process-card').filter({ hasText: title })
  await savedDraft.getByText('Wersja 1 · W toku', { exact: true }).waitFor()
  await savedDraft.getByRole('button', { name: 'Otwórz proces', exact: true }).click()
  assert.equal(await label('Pytania — pozycja 1').inputValue(), question)
  assert.equal(await label('Kroki — pozycja 1').inputValue(), asIs[0])
  await button('Zapisz propozycję').click()
  for (const index of asIs.keys()) await check(`Wybierz krok ${index + 1} do przeniesienia`)
  await button('Przenieś wybrane kroki do AS-IS').click()
  if (branched) {
    for (const [index, step] of asIs.entries()) {
      const numbered = `krok ${index + 1}: ${step}`
      await label(`Tor BPMN — ${numbered}`).fill(index === 0 ? manager : 'HR')
      await button(`Zapisz tor — ${numbered}`).click()
    }
    await choose('Od kroku', `2. ${asIs[1]}`)
    await choose('Do kroku', `1. ${asIs[0]}`)
    await label('Kiedy następuje przejście?').fill(returnPath)
    await button('Dodaj połączenie').click()
    await label(`Pytanie decyzji — ${asIs[1]}`).fill(decision)
    await label(`Kiedy kontynuować podstawową ścieżkę — ${asIs[1]}`).fill('Tak')
    await button(`Zapisz decyzję BPMN — ${asIs[1]}`).click()
    await choose('Krok w Twoim procesie', `${asIs.length}. ${asIs.at(-1)}`)
    await label('Nazwa basenu Twojego procesu').fill(organization)
    await label('Nazwa basenu zewnętrznego').fill(recipient)
    await label('Kierunek wiadomości').selectOption('outgoing')
    await label('Co jest przekazywane?').fill(message)
    await button('Dodaj wiadomość BPMN').click()
  }
  await button('Zapisz proces AS-IS').click()
  if (branched) await verifyModel(asIs[0], asIs[1], 'AS-IS')
  await button('Przejdź do analizy').click()

  await choose('Sprawdzony wyjątek z warsztatu', exception)
  await button('Wstaw wyjątek do formularza').click()
  await choose(/Kategoria/, 'Wąskie gardło')
  await label(/Nazwa problemu lub obserwacji/).fill(issue)
  await choose('Gdzie występuje?', `${checkIndex + 1}. ${asIs[checkIndex]}`)
  await label('Opis obecnej sytuacji').fill(exception)
  await label('Wstępny pomysł usprawnienia').fill(improvement)
  await button('Dodaj ustalenie').click()
  await button('Zapisz analizę').click()
  await button('Przejdź do TO-BE').click()

  await label(/Cel projektowanej zmiany/).fill('Ograniczyć liczbę zgłoszeń, które HR musi odsyłać do uzupełnienia')
  await button(branched ? 'Skopiuj mapę BPMN z AS-IS' : 'Skopiuj kroki z AS-IS').click()
  if (branched) {
    await button('Edytuj krok').first().click()
    await label(/Nazwa kroku/).fill(toBe[0])
    await button('Zapisz zmiany').click()
  }
  await button('Edytuj krok').nth(checkIndex).click()
  await label(/Nazwa kroku/).fill(toBe[checkIndex])
  await choose('Powiązane usprawnienie', issue)
  await button('Zapisz zmiany').click()
  await button('Zapisz proces TO-BE').click()
  if (branched) await verifyModel(toBe[0], toBe[1], 'TO-BE')
  await button('Przejdź do raportu').click()

  await label(/Nazwa osoby, roli lub zespołu/).fill(assignee)
  await button('Dodaj interesariusza').click()
  if (branched) {
    await label(/Nazwa osoby, roli lub zespołu/).fill(manager)
    await button('Dodaj interesariusza').click()
  }
  for (const [index, step] of toBe.entries()) {
    await label(`${step}: ${branched && index === 0 ? manager : assignee}`).selectOption('RA')
  }
  await button('Zapisz raport').click()
  await check(question)
  await page.evaluate(() => {
    window.__referralPrintCalled = false
    window.print = () => { window.__referralPrintCalled = true }
  })
  await button('Eksportuj do PDF').click()
  await page.waitForFunction(() => window.__referralPrintCalled)
  for (const [selector, names] of [['.print-bpmn-image:not(.print-tobe-bpmn)', asIs], ['.print-tobe-bpmn', toBe]]) {
    const result = await page.locator(selector).evaluate((image, { taskNames, branchText }) => {
      const svg = new DOMParser().parseFromString(decodeURIComponent(image.src.split(',')[1]), 'image/svg+xml').documentElement
      svg.style.position = 'fixed'
      svg.style.left = '-10000px'
      document.body.appendChild(svg)
      try {
        const taskLabelsFit = taskNames.map((name, index) => {
          const task = svg.querySelector(`[data-element-id="Task_${index + 1}"]`)
          const label = task.querySelector('text')
          const text = [...label.querySelectorAll('tspan')].map((line) => line.textContent.trim()).join(' ')
          const bounds = label.getBBox()
          const box = task.querySelector('rect').getBBox()
          return text === name && bounds.x >= box.x && bounds.y >= box.y
            && bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height
        })
        let branchLabelAboveLine = null
        if (branchText) {
          const text = [...svg.querySelectorAll('[data-element-id$="_label"] text')].find((element) => (
            [...element.querySelectorAll('tspan')].map((line) => line.textContent.trim()).join(' ') === branchText
          ))
          const labelId = text.closest('[data-element-id]').dataset.elementId
          const path = svg.querySelector(`[data-element-id="${labelId.replace(/_label$/, '')}"] .djs-visual path`)
          const box = text.getBBox()
          const bottom = new DOMPoint(box.x, box.y + box.height).matrixTransform(text.getCTM())
          const lineTop = new DOMPoint(0, path.getBBox().y).matrixTransform(path.getCTM())
          branchLabelAboveLine = bottom.y < lineTop.y
        }
        return { taskLabelsFit, branchLabelAboveLine }
      } finally {
        svg.remove()
      }
    }, { taskNames: names, branchText: branched ? returnPath : null })
    assert.deepEqual(result.taskLabelsFit, names.map(() => true), `all task labels must fit inside ${selector}`)
    if (branched) assert.equal(result.branchLabelAboveLine, true, `the return label must clear the line in ${selector}`)
  }

  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ format: 'A4', printBackground: true, ...(output ? { path: output } : {}) })
  const text = execFileSync('pdftotext', ['-', '-'], { input: pdf, encoding: 'utf8' }).replace(/\s+/g, ' ')
  const branchDetails = branched ? [decision, returnPath, organization, recipient, 'Dodatkowe przejścia', 'Baseny i wiadomości'] : []
  for (const expected of [title, ...asIs, ...toBe, issue, question, assignee, '20.11.2026', 'Mapa BPMN AS-IS', 'Mapa BPMN TO-BE', ...branchDetails]) {
    assert.ok(text.includes(expected), `PDF should include: ${expected}`)
  }
  console.log('PASS: referral workshop restored in a fresh tab; all AS-IS and TO-BE tasks fit; PDF contains the selected open question')
  if (branched) console.log('PASS: manager starts both maps; BPMN validates with two pools, two lanes, return path and referral handoff')
} finally {
  await browser.close()
}
