import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const B = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const workshop = (id) => `architekt-procesow:workshop:${id}`
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
try {
  await page.goto('http://127.0.0.1:5173/')
  await page.evaluate(({ a, b }) => {
    localStorage.clear(); sessionStorage.clear()
    localStorage.setItem('architekt-procesow:processes', JSON.stringify([{ id: a, name: 'Proces A', savedAt: '2026-11-17T10:00:00.000Z' }, { id: b, name: 'Proces B', savedAt: '2026-11-17T10:00:00.000Z' }]))
    localStorage.setItem('architekt-procesow:current-process-id', b)
    localStorage.setItem(`architekt-procesow:workshop:${a}`, 'tekst A')
    localStorage.setItem(`architekt-procesow:workshop:${a}:review`, 'propozycja A')
    localStorage.setItem(`architekt-procesow:workshop:${b}`, 'tekst B')
    sessionStorage.setItem('architekt-procesow-screen-to-open', 'processes')
  }, { a: A, b: B })
  await page.reload()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Usuń proces Proces A' }).click()
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), workshop(A)), 'tekst A')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Usuń proces Proces A' }).click()
  await page.getByText(/Proces i zapisane dane jego warsztatu zostały usunięte/).waitFor()
  const result = await page.evaluate(({ a, b }) => ({
    processes: JSON.parse(localStorage.getItem('architekt-procesow:processes')).map((p) => p.id),
    a: localStorage.getItem(`architekt-procesow:workshop:${a}`),
    review: localStorage.getItem(`architekt-procesow:workshop:${a}:review`),
    b: localStorage.getItem(`architekt-procesow:workshop:${b}`),
  }), { a: A, b: B })
  assert.deepEqual(result, { processes: [B], a: null, review: null, b: 'tekst B' })
  await page.getByRole('button', { name: 'Usuń proces Proces B' }).click()
  await page.getByText(/To obecnie otwarty proces/).waitFor()
  console.log('PASS: confirmed deletion removes only selected inactive process and workshop; cancellation and active-process guard work')
} finally {
  await browser.close()
}
