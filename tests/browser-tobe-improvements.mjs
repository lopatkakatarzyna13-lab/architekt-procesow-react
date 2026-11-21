import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { BpmnModdle } from 'bpmn-moddle'
import { chromium, expect } from 'playwright/test'
import { preview } from 'vite'

const origin = 'http://127.0.0.1:4173'
const name = 'Skierowanie na badania wstępne — propozycje TO-BE'
const form = 'Kierownik wypełnia formularz'
const oldIntake = 'Kadry przyjmują zgłoszenie mailem'
const generate = 'System generuje skierowanie'
const validation = 'Walidacja pól obowiązkowych'
const review = 'Kontrola merytoryczna zgłoszenia przez człowieka'
const required = 'Stanowisko i warunki pracy'
const originalDescription = 'Kierownik podaje dane stanowiska.'
const finding = 'Brak danych w zgłoszeniu'
const constraint = 'Kadry zachowują kontrolę merytoryczną.'
const decision = 'Czy wszystkie pola obowiązkowe są uzupełnione?'
const successfulPath = 'Tak, dane kompletne'
const returnPath = 'Nie, wróć do formularza'
const server = await preview({ mode: 'workshop-local' })
let browser

try {
  browser = await chromium.launch()
  const context = await browser.newContext()
  const remoteRequests = []
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue()
    remoteRequests.push(url.href)
    return route.abort('internetdisconnected')
  })
  const page = await context.newPage()
  const button = (label) => page.getByRole('button', { name: label, exact: true })
  const field = (label) => page.getByLabel(label, { exact: typeof label === 'string' })
  const choose = (label, option) => field(label).selectOption({ label: option })
  const toBeList = page.locator('.to-be-steps-list')
  const editButtons = toBeList.getByRole('button', { name: 'Edytuj krok', exact: true })
  const showBpmnDetails = async () => {
    const summary = page.getByText('Dokumenty i szczegóły wykonania', { exact: true })
    if (!await summary.evaluate((element) => element.parentElement.open)) await summary.click()
  }

  await page.goto(origin)
  await page.getByRole('button', { name: /Dodaj kroki samodzielnie/ }).click()
  await field(/Nazwa procesu/).fill(name)
  await field(/Cel procesu/).fill('Przygotować skierowanie po sprawdzeniu danych stanowiska')
  await field(/Co rozpoczyna proces/).fill('Zgłoszenie kierownika')
  await field(/Co kończy proces/).fill('Wygenerowanie skierowania')
  await button('Zapisz zakres i przejdź dalej').click()
  for (const step of [form, oldIntake, generate]) {
    await field(/Nazwa kroku/).fill(step)
    if (step === generate) {
      await field('Typ zadania BPMN').selectOption('service')
      await field('Wykorzystywany system lub narzędzie').fill('System HR')
    }
    if (step === oldIntake) {
      await showBpmnDetails()
      await field('Wymagane dane').fill(required)
    }
    await button('Dodaj krok').click()
  }
  await button('Zapisz proces AS-IS').click()
  await button('Przejdź do analizy').click()
  await choose(/Kategoria/, 'Ryzyko lub możliwość błędu')
  await field(/Nazwa problemu lub obserwacji/).fill(finding)
  await choose('Gdzie występuje?', `2. ${oldIntake}`)
  await button('Dodaj ustalenie').click()
  await button('Zapisz analizę').click()
  await button('Przejdź do TO-BE').click()

  await field(/Cel projektowanej zmiany/).fill('Wyłapać braki w formularzu przed wysłaniem')
  await field('Najważniejsze ograniczenia lub warunki').fill(constraint)
  await field(/Nazwa kroku/).fill(form)
  await field('Opis czynności').fill(originalDescription)
  await field('Osoba lub rola odpowiedzialna').fill('Kierownik')
  await button('Dodaj krok').click()
  await expect(button('Skopiuj mapę BPMN z AS-IS')).toBeDisabled()

  const selectFinding = () => choose('Powiązane usprawnienie', finding)
  const useSuggestion = (title) => page.getByRole('complementary', { name: title, exact: true })
    .getByRole('button', { name: 'Uzupełnij puste pola propozycją', exact: true }).click()
  await selectFinding()
  await expect(field(/Nazwa kroku/)).toHaveValue('')
  await field('Opis czynności').fill('Formularz wskazuje brakujące dane stanowiska.')
  await useSuggestion(validation)
  await expect(field(/Nazwa kroku/)).toHaveValue(validation)
  await expect(field('Opis czynności')).toHaveValue('Formularz wskazuje brakujące dane stanowiska.')
  await expect(field('Typ zadania BPMN')).toHaveValue('service')
  await showBpmnDetails()
  await expect(field('Wymagane dane')).toHaveValue(required)
  await expect(field('Wyjątek')).toHaveValue(/wróć do formularza/)
  await button('Dodaj krok').click()

  await selectFinding()
  await useSuggestion(review)
  await field('Osoba lub rola odpowiedzialna').fill('Kadry')
  await expect(field('Typ zadania BPMN')).toHaveValue('user')
  await showBpmnDetails()
  await expect(field('Punkt kontroli człowieka')).toHaveValue(/zatwierdza merytorycznie/)
  await button('Dodaj krok').click()

  await editButtons.first().click()
  await field('Rezultat kroku').fill('Dane zgłoszenia wpisane do formularza.')
  await page.getByText('Wybierz kroki z AS-IS', { exact: true }).click()
  const copy = button('Dodaj wybrane kroki z AS-IS')
  await expect(copy).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: form, exact: true })).toHaveCount(0)
  const fromAsIs = page.getByRole('checkbox', { name: generate, exact: true })
  await fromAsIs.check()
  await copy.click()
  await expect(fromAsIs).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: oldIntake, exact: true })).toBeVisible()
  await expect(field('Rezultat kroku')).toHaveValue('Dane zgłoszenia wpisane do formularza.')
  await expect(field('Opis czynności')).toHaveValue(originalDescription)
  await button('Zapisz zmiany').click()
  await expect(toBeList.locator('li')).toHaveCount(4)
  await expect(toBeList).not.toContainText(oldIntake)

  await choose('Od kroku', `2. ${validation}`)
  await choose('Do kroku', `1. ${form}`)
  await field('Kiedy następuje przejście?').fill(returnPath)
  await button('Dodaj połączenie').click()
  await field(`Pytanie decyzji — ${validation}`).fill(decision)
  await field(`Kiedy kontynuować podstawową ścieżkę — ${validation}`).fill(successfulPath)
  await button(`Zapisz decyzję BPMN — ${validation}`).click()
  await button('Zapisz proces TO-BE').click()
  await expect(page.getByText('Proces TO-BE został zapisany', { exact: true })).toBeVisible()
  await page.reload()
  await expect(field('Najważniejsze ograniczenia lub warunki')).toHaveValue(constraint)
  await expect(toBeList.locator('li').first()).toContainText(originalDescription)
  await expect(toBeList.locator('li')).toHaveCount(4)
  await expect(page.locator('.to-be-finding').filter({ hasText: finding })).toContainText(validation)

  const [download] = await Promise.all([page.waitForEvent('download'), button('Pobierz BPMN 2.0').click()])
  const path = await download.path()
  execFileSync('java', ['tests/ValidateBpmnXsd.java', 'node_modules/bpmn-moddle/resources/bpmn/xsd/BPMN20.xsd', path], { stdio: 'inherit' })
  const model = await new BpmnModdle().fromXML(await readFile(path, 'utf8'))
  assert.deepEqual(model.warnings, [])
  const { flowElements } = model.rootElement.rootElements.find((element) => element.$type === 'bpmn:Process')
  const task = (title) => flowElements.find((element) => element.name === title)
  const flows = flowElements.filter((element) => element.$type === 'bpmn:SequenceFlow')
  const flowsTo = (source, target, branch) => flows.some((flow) => flow.sourceRef === task(source)
    && flow.targetRef === task(target) && (branch === undefined || flow.name === branch))
  assert.equal(task(validation).$type, 'bpmn:ServiceTask')
  assert.match(task(validation).documentation[0].text, /Wymagane dane: Stanowisko i warunki pracy/)
  assert.equal(task(review).$type, 'bpmn:UserTask')
  assert.match(task(review).documentation[0].text, /Punkt kontroli człowieka/)
  assert.equal(task(decision).$type, 'bpmn:ExclusiveGateway')
  assert.ok(flowsTo(form, validation))
  assert.ok(flowsTo(validation, decision))
  const returnFlow = flows.find((flow) => flow.sourceRef === task(decision) && flow.name === returnPath)
  assert.equal(returnFlow?.targetRef.gatewayDirection, 'Converging')
  assert.ok(flows.some((flow) => flow.sourceRef === returnFlow.targetRef && flow.targetRef === task(form)))
  assert.ok(flowsTo(decision, review, successfulPath))
  assert.ok(flowsTo(review, generate))
  assert.deepEqual(remoteRequests, [])
  console.log('PASS: selective AS-IS import, preserved TO-BE draft and fields, validation and human review after reopening, both BPMN paths')
} finally {
  try {
    await browser?.close()
  } finally {
    await server.close()
  }
}
