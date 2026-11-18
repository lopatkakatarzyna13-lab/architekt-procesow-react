import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const title = 'Skierowanie na badania wstępne – próba'
const asIs = [
  'HR sprawdza, czy kierownik podał stanowisko i opisał warunki pracy',
  'HR przygotowuje skierowanie po otrzymaniu kompletu informacji.',
  'HR wysyła skierowanie mailem do osoby przyjmowanej.',
]
const toBe = ['HR weryfikuje zgłoszenie przesłane przez formularz', ...asIs.slice(1)]
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

  await open()
  await page.getByRole('button', { name: /Tryb ekspercki/ }).click()
  await page.getByRole('button', { name: /Dodaj kroki samodzielnie/ }).click()
  await label(/Nazwa procesu/).fill(title)
  await label(/Cel procesu/).fill('Przekazać osobie przyjmowanej kompletne skierowanie, aby mogła umówić badania wstępne.')
  await label(/Co rozpoczyna proces/).fill('HR otrzymuje od kierownika potwierdzenie przyjęcia nowej osoby.')
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
  await button('Zapisz proces AS-IS').click()
  await button('Przejdź do analizy').click()

  await choose('Sprawdzony wyjątek z warsztatu', exception)
  await button('Wstaw wyjątek do formularza').click()
  await choose(/Kategoria/, 'Wąskie gardło')
  await label(/Nazwa problemu lub obserwacji/).fill(issue)
  await choose('Gdzie występuje?', `1. ${asIs[0]}`)
  await label('Opis obecnej sytuacji').fill(exception)
  await label('Wstępny pomysł usprawnienia').fill(improvement)
  await button('Dodaj ustalenie').click()
  await button('Zapisz analizę').click()
  await button('Przejdź do TO-BE').click()

  await label(/Cel projektowanej zmiany/).fill('Ograniczyć liczbę zgłoszeń, które HR musi odsyłać do uzupełnienia')
  await button('Skopiuj kroki z AS-IS').click()
  await button('Edytuj krok').first().click()
  await label(/Nazwa kroku/).fill(toBe[0])
  await choose('Powiązane usprawnienie', issue)
  await button('Zapisz zmiany').click()
  await button('Zapisz proces TO-BE').click()
  await button('Przejdź do raportu').click()

  await label(/Nazwa osoby, roli lub zespołu/).fill(assignee)
  await button('Dodaj interesariusza').click()
  for (const step of toBe) await label(`${step}: ${assignee}`).selectOption('RA')
  await button('Zapisz raport').click()
  await check(question)
  await page.evaluate(() => {
    window.__referralPrintCalled = false
    window.print = () => { window.__referralPrintCalled = true }
  })
  await button('Eksportuj do PDF').click()
  await page.waitForFunction(() => window.__referralPrintCalled)
  for (const [selector, names] of [['.print-bpmn-image:not(.print-tobe-bpmn)', asIs], ['.print-tobe-bpmn', toBe]]) {
    const result = await page.locator(selector).evaluate((image, taskNames) => {
      const svg = new DOMParser().parseFromString(decodeURIComponent(image.src.split(',')[1]), 'image/svg+xml').documentElement
      svg.style.position = 'fixed'
      svg.style.left = '-10000px'
      document.body.appendChild(svg)
      try {
        return taskNames.map((name, index) => {
          const task = svg.querySelector(`[data-element-id="Task_${index + 1}"]`)
          const label = task.querySelector('text')
          const text = [...label.querySelectorAll('tspan')].map((line) => line.textContent.trim()).join(' ')
          const bounds = label.getBBox()
          const box = task.querySelector('rect').getBBox()
          return text === name && bounds.x >= box.x && bounds.y >= box.y
            && bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height
        })
      } finally {
        svg.remove()
      }
    }, names)
    assert.deepEqual(result, [true, true, true], `all task labels must fit inside ${selector}`)
  }

  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ format: 'A4', printBackground: true, ...(output ? { path: output } : {}) })
  const text = execFileSync('pdftotext', ['-', '-'], { input: pdf, encoding: 'utf8' }).replace(/\s+/g, ' ')
  for (const expected of [title, ...asIs, ...toBe, issue, question, assignee, '20.11.2026', 'Mapa BPMN AS-IS', 'Mapa BPMN TO-BE']) {
    assert.ok(text.includes(expected), `PDF should include: ${expected}`)
  }
  console.log('PASS: referral workshop restored in a fresh tab; all AS-IS and TO-BE tasks fit; PDF contains the selected open question')
} finally {
  await browser.close()
}
