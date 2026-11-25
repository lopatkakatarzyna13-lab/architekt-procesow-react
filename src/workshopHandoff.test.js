import { expect, it } from 'vitest'
import { proposeDocumentHandoff } from './workshopHandoff.js'
import { applyWorkshopDocument } from './workshopDocuments.js'

it('wykorzystuje zatwierdzoną nazwę i odbiorcę z czynności wysyłki', () => {
  expect(proposeDocumentHandoff('Gdy dane są kompletne, przekazuję zestawienie do biura rachunkowego e-mailem',
    { direction: 'output', name: 'Raport miesięczny' })).toEqual({
    direction: 'outgoing', external: 'Biuro rachunkowe', label: 'Raport miesięczny',
  })
})

it('rozpoznaje nadawcę przy odbiorze dokumentu', () => {
  expect(proposeDocumentHandoff('HR otrzymuje potwierdzenie od poradni medycyny pracy przez portal',
    { direction: 'input', name: 'Potwierdzenie' })).toMatchObject({ direction: 'incoming', external: 'Poradnia medycyny pracy' })
})

it.each(['Kadry wysyłają raport przez portal', 'HR wysyła raport do biura', 'HR wysyła raport do biura rachunkowego Alfa'])(
  'pozostawia nazwę uczestnika do rozstrzygnięcia: %s', (activity) => {
    expect(proposeDocumentHandoff(activity, { direction: 'output', name: 'Raport' }).external).toBe('')
  })

it('pomija wytworzenie dokumentu, sprzeczny kierunek oraz kilka czynności przekazania', () => {
  const doc = { direction: 'output', name: 'Raport' }
  for (const text of ['HR generuje raport dla biura rachunkowego', 'HR odbiera raport od biura rachunkowego',
    'HR otrzymuje raport i przekazuje dokument do biura rachunkowego']) {
    expect(proposeDocumentHandoff(text, doc)).toBeNull()
  }
})

it('wiąże cytat z identycznym dokumentem wpisanym wcześniej ręcznie', () => {
  const manual = { name: 'Raport', direction: 'output', format: 'PDF', channel: '' }
  const before = [{ id: 'a', bpmnDocuments: [manual] }]
  const after = applyWorkshopDocument(before, 'a', manual, 'output:raport')
  expect(after[0].bpmnDocuments).toEqual([{ ...manual, workshopSource: 'output:raport' }])
  expect(applyWorkshopDocument(after, 'a', manual, 'output:raport')).toBe(after)
  expect(before[0].bpmnDocuments[0]).toBe(manual)
})
