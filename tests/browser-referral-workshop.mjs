import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { BpmnModdle } from 'bpmn-moddle'
import { chromium } from 'playwright'

const branched = process.env.REFERRAL_WITH_POOLS === '1'
const enriched = branched && process.env.REFERRAL_HANDOFF !== '0'
const title = enriched ? 'Skierowanie na badania wstępne – przekazanie do IT' : branched ? 'Skierowanie na badania wstępne – decyzja i baseny' : 'Skierowanie na badania wstępne – próba'
const managerTask = 'Kierownik przekazuje zgłoszenie lub uzupełnia dane stanowiska'
const managerFormTask = 'Kierownik przekazuje zgłoszenie lub uzupełnia dane w formularzu'
const manager = 'Kierownik'
const organization = 'Organizacja'
const recipient = 'Osoba przyjmowana'
const decision = 'Czy dane są kompletne?'
const returnPath = 'Nie: HR prosi kierownika o uzupełnienie'
const targetDecision = 'Czy opis warunków pracy jest wystarczający?'
const targetReturnPath = 'Nie: HR prosi kierownika o doprecyzowanie'
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
  ...(enriched ? ['System HR generuje skierowanie z danych formularza', asIs.at(-1)] : asIs.slice(checkIndex + 1)),
]
const issue = 'Brak opisu warunków pracy wydłuża przygotowanie skierowania.'
const exception = 'Gdy brakuje opisu warunków pracy, HR prosi kierownika o uzupełnienie i czeka na odpowiedź.'
const improvement = 'Kierownik zgłasza nową osobę na formularzu z obowiązkowym polem „Warunki pracy”.'
const question = 'Kto wysyła skierowanie podczas nieobecności koordynatorki HR?'
const assignee = 'Koordynatorka HR'
const oldSteps = [
  {
    type: 'manual', owner: manager, system: '',
    documents: [
      ['input', 'Dane stanowiska', 'Papier', 'Osobiście'],
      ['output', 'Zgłoszenie papierowe', 'Papier', 'Osobiście'],
    ],
    fields: { 'Wymagane dane': 'Stanowisko i warunki pracy', 'Reguła': 'Swobodny wzór bez obowiązkowych pól.' },
  },
  {
    type: 'manual', owner: 'HR', system: '',
    documents: [['input', 'Zgłoszenie papierowe', 'Papier', 'Osobiście']],
    fields: {
      'Wyjątek': 'Jeżeli brakuje warunków pracy, HR odsyła zgłoszenie do kierownika.',
      'Czas oczekiwania': 'Do 2 dni na odpowiedź kierownika.',
      'Punkt kontroli człowieka': 'HR sprawdza kompletność opisu warunków pracy.',
    },
  },
  {
    type: 'user', owner: 'HR', system: 'System HR',
    documents: [['output', 'Skierowanie', 'PDF', 'System HR']],
    fields: { 'Reguła': 'HR przepisuje stanowisko i warunki pracy z papieru.', 'Czas pracy': 'Fikcyjnie 5 minut przepisywania.' },
  },
  { type: 'user', owner: 'HR', system: 'Poczta', documents: [['output', 'Skierowanie do badań', 'PDF', 'E-mail']], fields: {} },
]
const approvedRecord = 'Zatwierdzone zgłoszenie'
const generateRule = 'System generuje skierowanie wyłącznie z rekordu zatwierdzonego przez HR.'
const newSteps = [
  {
    ...oldSteps[0], type: 'user', system: 'Formularz HR',
    documents: [['input', 'Dane stanowiska', 'Formularz', 'Portal HR'], ['output', 'Rekord zgłoszenia', 'Rekord', 'Integracja']],
    fields: { ...oldSteps[0].fields, 'Reguła': 'Formularz blokuje wysłanie bez stanowiska i warunków pracy.' },
  },
  {
    ...oldSteps[1], type: 'user', system: 'System HR',
    documents: [['input', 'Rekord zgłoszenia', 'Rekord', 'Integracja'], ['output', approvedRecord, 'Rekord', 'System HR']],
    fields: {
      'Wyjątek': 'HR zwraca opis wymagający doprecyzowania merytorycznego.',
      'Czas oczekiwania': '',
      'Punkt kontroli człowieka': 'HR akceptuje merytorycznie warunki pracy przed wygenerowaniem PDF.',
    },
  },
  {
    ...oldSteps[2], type: 'service',
    documents: [['input', approvedRecord, 'Rekord', 'System HR'], ...oldSteps[2].documents],
    fields: { 'Reguła': generateRule, 'Czas pracy': '' },
  },
  {
    ...oldSteps[3],
    documents: [['input', 'Skierowanie', 'PDF', 'System HR'], ...oldSteps[3].documents],
  },
]
const output = process.env.REFERRAL_PDF_PATH
const bpmnPrefix = process.env.REFERRAL_BPMN_PREFIX
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

  const openStep = async (index) => {
    await page.getByRole('button', { name: /^Edytuj krok/ }).nth(index).click()
    const section = page.getByText('Dokumenty i szczegóły wykonania', { exact: true })
    if (!await section.evaluate((element) => element.parentElement.open)) await section.click()
  }

  const fillDetails = async ({ type, owner, system, documents, fields }) => {
    await label('Typ zadania BPMN').selectOption(type)
    await label('Osoba lub rola odpowiedzialna').fill(owner)
    await label('Wykorzystywany system lub narzędzie').fill(system)
    while (await button('Usuń dokument 1').count()) await button('Usuń dokument 1').click()
    for (const [index, [direction, name, format, channel]] of documents.entries()) {
      await button(`Dodaj dokument — ${direction === 'input' ? 'wejście' : 'wyjście'}`).click()
      await label(new RegExp(`Nazwa dokumentu — dokument ${index + 1}`)).fill(name)
      await label(`Format — dokument ${index + 1}`).fill(format)
      await label(`Kanał przekazania — dokument ${index + 1}`).fill(channel)
    }
    for (const [name, value] of Object.entries(fields)) await label(name).fill(value)
  }

  const verifyModel = async (firstTask, checkTask, label) => {
    const [download] = await Promise.all([page.waitForEvent('download'), button('Pobierz BPMN 2.0').click()])
    const path = await download.path()
    execFileSync('java', ['tests/ValidateBpmnXsd.java', 'node_modules/bpmn-moddle/resources/bpmn/xsd/BPMN20.xsd', path], { stdio: 'inherit' })
    const xml = await readFile(path, 'utf8')
    if (enriched && bpmnPrefix) {
      await writeFile(`${bpmnPrefix}-${label.toLowerCase()}.bpmn`, xml)
    }
    const { rootElement, warnings } = await new BpmnModdle().fromXML(xml)
    assert.deepEqual(warnings, [], label)
    const collaboration = rootElement.rootElements.find((item) => item.$type === 'bpmn:Collaboration')
    assert.deepEqual(collaboration.participants.map((item) => item.name), [organization, recipient])
    const process = collaboration.participants[0].processRef
    const tasks = process.flowElements.filter((item) => item.$instanceOf('bpmn:Task'))
    const lanes = process.laneSets[0].lanes
    const start = process.flowElements.find((item) => item.$type === 'bpmn:StartEvent')
    assert.deepEqual(lanes.map((lane) => lane.name), [manager, 'HR'])
    assert.ok(lanes[0].flowNodeRef.includes(start))
    assert.equal(tasks[0].name, firstTask)
    assert.ok(lanes[0].flowNodeRef.includes(tasks[0]))
    assert.ok(lanes[1].flowNodeRef.includes(tasks[1]))
    assert.equal(tasks[1].name, checkTask)
    if (enriched) {
      const fixture = label === 'AS-IS' ? oldSteps : newSteps
      const taskTypes = { manual: 'ManualTask', user: 'UserTask', service: 'ServiceTask', '': 'Task' }
      assert.deepEqual(tasks.map((task) => task.$type), fixture.map(({ type }) => `bpmn:${taskTypes[type]}`))
      const plane = rootElement.diagrams[0].plane.planeElement
      const references = process.flowElements.filter((item) => item.$type === 'bpmn:DataObjectReference')
      assert.deepEqual(references.map(({ name }) => name), fixture.flatMap(({ documents }) => documents.map(([, name]) => name)))
      for (const [index, task] of tasks.entries()) {
        const { owner, system, fields, documents } = fixture[index]
        const details = task.documentation[0].text
        for (const value of [owner, system, ...Object.values(fields)].filter(Boolean)) assert.ok(details.includes(value), value)
        for (const [direction, name, format, channel] of documents) {
          const associations = task.get(direction === 'input' ? 'dataInputAssociations' : 'dataOutputAssociations')
          const association = associations.find((item) => (direction === 'input' ? item.sourceRef[0] : item.targetRef).name === name)
          assert.ok(association, name)
          const reference = direction === 'input' ? association.sourceRef[0] : association.targetRef
          const property = direction === 'input' ? association.targetRef : association.sourceRef[0]
          assert.ok(task.properties.includes(property))
          assert.equal(reference.dataObjectRef.$type, 'bpmn:DataObject')
          assert.equal(reference.documentation[0].text, `Format: ${format}\nKanał przekazania: ${channel}`)
          assert.ok(plane.some((item) => item.bpmnElement === reference && item.$type === 'bpmndi:BPMNShape'))
          assert.ok(plane.some((item) => item.bpmnElement === association && item.$type === 'bpmndi:BPMNEdge'))
        }
      }
    }
    const targetVariant = enriched && label === 'TO-BE'
    const gateway = process.flowElements.find((item) => item.name === (targetVariant ? targetDecision : decision))
    assert.equal(gateway.incoming[0].sourceRef, tasks[1])
    const yes = gateway.outgoing.find((item) => item.name === 'Tak')
    const no = gateway.outgoing.find((item) => item.name === (targetVariant ? targetReturnPath : returnPath))
    assert.equal(yes.targetRef, tasks[2])
    if (targetVariant) {
      const [, review, generation, delivery] = tasks
      assert.match(generation.documentation[0].text, /^Odpowiedzialność biznesowa: HR$/m)
      assert.match(generation.documentation[0].text, /^System: System HR$/m)
      assert.doesNotMatch(generation.documentation[0].text, /^Wykonawca: HR$/m)
      assert.equal(review.dataOutputAssociations[0].targetRef.name, approvedRecord)
      assert.equal(generation.dataInputAssociations[0].sourceRef[0].name, approvedRecord)
      assert.equal(generation.outgoing[0].targetRef, delivery)
      assert.equal(delivery.dataInputAssociations[0].sourceRef[0].name, generation.dataOutputAssociations[0].targetRef.name)
    }
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
  const savedDraft = () => page.locator('.process-card').filter({ hasText: title })
  await savedDraft().getByText('Wersja 1 · W toku', { exact: true }).waitFor()
  await savedDraft().getByRole('button', { name: 'Otwórz proces', exact: true }).click()
  assert.equal(await label('Pytania — pozycja 1').inputValue(), question)
  assert.equal(await label('Kroki — pozycja 1').inputValue(), asIs[0])
  await button('Zapisz propozycję').click()
  for (const index of asIs.keys()) await check(`Wybierz krok ${index + 1} do przeniesienia`)
  await button('Przenieś wybrane kroki do AS-IS').click()
  if (enriched) {
    for (const [index, step] of oldSteps.entries()) {
      await openStep(index)
      await fillDetails(step)
      await button('Zapisz zmiany').click()
    }
    // Resume the open, unsaved editing form from the process library.
    await openStep(0)
    await label('Częstotliwość').fill('Szkic do anulowania')
    await page.close()
    page = await context.newPage()
    page.on('dialog', (dialog) => dialog.accept())
    await open()
    await button('Moje procesy').click()
    await savedDraft().getByRole('button', { name: 'Otwórz proces', exact: true }).click()
    assert.equal(await label('Typ zadania BPMN').inputValue(), 'manual')
    await page.getByText('Dokumenty i szczegóły wykonania', { exact: true }).click()
    assert.equal(await label('Kanał przekazania — dokument 2').inputValue(), 'Osobiście')
    assert.equal(await label('Częstotliwość').inputValue(), 'Szkic do anulowania')
    await button('Anuluj edycję').click()
  }
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
  if (enriched) {
    for (const [index, detail] of newSteps.entries()) {
      await openStep(index)
      assert.equal(await label('Typ zadania BPMN').inputValue(), oldSteps[index].type)
      if (oldSteps[index].documents.length) {
        assert.equal(await label('Kanał przekazania — dokument 1').inputValue(), oldSteps[index].documents[0][3])
      }
      await label(/Nazwa kroku/).fill(toBe[index])
      await fillDetails(detail)
      if (index === checkIndex) await choose('Powiązane usprawnienie', issue)
      await button('Zapisz zmiany').click()
    }
    await button(`Usuń połączenie ${toBe[1]} do ${toBe[0]}: ${returnPath}`).click()
    await choose('Od kroku', `2. ${toBe[1]}`)
    await choose('Do kroku', `1. ${toBe[0]}`)
    await label('Kiedy następuje przejście?').fill(targetReturnPath)
    await button('Dodaj połączenie').click()
    await label(`Pytanie decyzji — ${toBe[1]}`).fill(targetDecision)
    await label(`Kiedy kontynuować podstawową ścieżkę — ${toBe[1]}`).fill('Tak')
    await button(`Zapisz decyzję BPMN — ${toBe[1]}`).click()
  } else {
    if (branched) {
      await button('Edytuj krok').first().click()
      await label(/Nazwa kroku/).fill(toBe[0])
      await button('Zapisz zmiany').click()
    }
    await button('Edytuj krok').nth(checkIndex).click()
    await label(/Nazwa kroku/).fill(toBe[checkIndex])
    await choose('Powiązane usprawnienie', issue)
    await button('Zapisz zmiany').click()
  }
  await button('Zapisz proces TO-BE').click()
  if (enriched) {
    await page.close()
    page = await context.newPage()
    await open()
    await button('Moje procesy').click()
    await savedDraft().getByRole('button', { name: 'Otwórz proces', exact: true }).click()
  }
  if (branched) await verifyModel(toBe[0], toBe[1], 'TO-BE')
  if (enriched) {
    await button('Pokaż podgląd BPMN').click()
    await page.locator('.bpmn-preview-canvas [data-element-id="Document_Task_1_input_1"]').waitFor()
    await label('Przejdź do elementu mapy').selectOption('Task_1')
    assert.ok(await page.getByText('Formularz blokuje wysłanie bez stanowiska i warunków pracy.', { exact: true }).isVisible())
  }
  await button('Przejdź do raportu').click()

  await label(/Nazwa osoby, roli lub zespołu/).fill(assignee)
  await button('Dodaj interesariusza').click()
  if (branched && !enriched) {
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
  await page.waitForFunction(() => window.__referralPrintCalled).catch(async (error) => {
    const messages = await page.getByRole('alert').allTextContents()
    throw new Error(`Nie wygenerowano PDF. ${messages.join(' ')}`, { cause: error })
  })
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
        let messageLabelClearsLine = null
        if (branchText) {
          const text = [...svg.querySelectorAll('[data-element-id$="_label"] text')].find((element) => (
            [...element.querySelectorAll('tspan')].map((line) => line.textContent.trim()).join(' ') === branchText
          ))
          const labelId = text.closest('[data-element-id]').dataset.elementId
          const path = svg.querySelector(`.djs-connection[data-element-id="${labelId.replace(/_label$/, '')}"] .djs-visual > path`)
          const box = text.getBBox()
          const bottom = new DOMPoint(box.x, box.y + box.height).matrixTransform(text.getCTM())
          const lineTop = new DOMPoint(0, path.getBBox().y).matrixTransform(path.getCTM())
          branchLabelAboveLine = bottom.y < lineTop.y
          const messageText = svg.querySelector('[data-element-id="MessageFlow_1_label"] text')
          const messagePath = svg.querySelector('.djs-connection[data-element-id="MessageFlow_1"] .djs-visual > path')
          const messageLeft = new DOMPoint(messageText.getBBox().x, 0).matrixTransform(messageText.getCTM()).x
          const messageStart = messagePath.getPointAtLength(0).matrixTransform(messagePath.getCTM())
          messageLabelClearsLine = messageLeft > messageStart.x
        }
        return { taskLabelsFit, branchLabelAboveLine, messageLabelClearsLine }
      } finally {
        svg.remove()
      }
    }, { taskNames: names, branchText: branched ? (enriched && names === toBe ? targetReturnPath : returnPath) : null })
    assert.deepEqual(result.taskLabelsFit, names.map(() => true), `all task labels must fit inside ${selector}`)
    if (branched) {
      assert.equal(result.branchLabelAboveLine, true, `the return label must clear the line in ${selector}`)
      assert.equal(result.messageLabelClearsLine, true, `the message label must clear its vertical segment in ${selector}`)
    }
  }

  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, ...(output ? { path: output } : {}) })
  const pages = execFileSync('pdftotext', ['-', '-'], { input: pdf, encoding: 'utf8' })
    .split('\f').map((page) => page.replace(/\s+/g, ' '))
  const text = pages.join(' ')
  const recommendations = text.split('09 Rekomendacje').at(-1).split('10 Otwarte pytania po warsztacie')[0]
  assert.ok(recommendations.includes('Kroki oznaczone jako możliwe do automatyzacji'))
  assert.ok(recommendations.includes('Brak oznaczonych kroków TO-BE.'))
  assert.ok(recommendations.includes(`Pomysły usprawnień z analizy ${improvement}`))
  if (enriched) {
    for (const [variant, document] of [['AS-IS', 'Zgłoszenie papierowe'], ['TO-BE', approvedRecord]]) {
      const mapPage = pages.find((page) => page.includes(`Mapa BPMN ${variant}`))
      const diagram = mapPage?.split('Szczegóły kroków BPMN')[0]
      assert.ok(diagram?.includes(recipient) && diagram.includes(document), `PDF must keep the ${variant} diagram and heading together`)
    }
  }
  const branchDetails = branched ? [decision, returnPath, organization, recipient, 'Dodatkowe przejścia', 'Baseny i wiadomości'] : []
  const handoffDetails = enriched ? [
    'Szczegóły kroków BPMN AS-IS', 'Szczegóły kroków BPMN TO-BE', targetDecision, targetReturnPath,
    'HR przepisuje stanowisko i warunki pracy z papieru.',
    'Do 2 dni na odpowiedź kierownika.',
    'Formularz blokuje wysłanie bez stanowiska i warunków pracy.',
    generateRule, 'Odpowiedzialność biznesowa HR', approvedRecord,
    'HR akceptuje merytorycznie warunki pracy przed wygenerowaniem PDF.',
  ] : []
  for (const expected of [title, ...asIs, ...toBe, issue, question, assignee, '20.11.2026', 'Mapa BPMN AS-IS', 'Mapa BPMN TO-BE', ...branchDetails, ...handoffDetails]) {
    assert.ok(text.includes(expected), `PDF should include: ${expected}`)
  }
  console.log('PASS: referral workshop restored in a fresh tab; all AS-IS and TO-BE tasks fit; PDF contains the selected open question')
  if (enriched) console.log('PASS: both models preserve task types, associated documents and handoff details after local resume and copy')
  if (branched) console.log('PASS: manager starts both maps; BPMN validates with two pools, two lanes, return path and referral handoff')
} finally {
  await browser.close()
}
