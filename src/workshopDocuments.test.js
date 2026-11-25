import { expect, it } from 'vitest'
import { proposeLocalWorkshop } from './localWorkshopProposal.js'
import { applyWorkshopDocument, documentFromActivity, workshopDocumentProposals } from './workshopDocuments.js'

it('proponuje format, kanał i kierunek wymienione w wypowiedzi', () => {
  expect(documentFromActivity('Pracownik odbiera skierowanie na badania wstępne w formacie PDF przez portal')).toEqual({
    direction: 'input', name: 'Skierowanie na badania wstępne', format: 'PDF', channel: 'portal',
  })
  expect(documentFromActivity('HR wysyła zestawienie nieobecności e-mailem')).toEqual({
    direction: 'output', name: 'Zestawienie nieobecności', format: '', channel: 'e-mail',
  })
  expect(documentFromActivity('HR otrzymuje wniosek o urlop na papierze osobiście')).toMatchObject({ direction: 'input', format: 'papier', channel: 'osobiście' })
})

it('pomija niejasne czynności, alternatywy i treści zanegowane', () => {
  for (const text of ['HR nie wysyła skierowania', 'Kadry mogą sprawdzić dane', 'HR wysyła wniosek lub formularz',
    'HR wysyła dane do biura', 'Pracownik wysyła dokument bez podpisu', 'Czy kadry wysyłają dokument?']) {
    expect(documentFromActivity(text)).toBeNull()
  }
  expect(documentFromActivity('HR przygotowuje raport o obsłudze PDF').format).toBe('')
})

it('po zmianie nazwy kroku używa oryginalnego cytatu i sprawdza jednoznaczność przypisania', () => {
  const original = proposeLocalWorkshop('HR wysyła formularz e-mailem.').steps
  const item = { ...original[0], text: 'Wysłanie formularza', reviewed: true }
  const analysis = { source: 'local-transcript', steps: [item] }
  const steps = [{ id: 'a', name: item.text }]
  expect(workshopDocumentProposals(analysis, steps, original)[0]).toMatchObject({ evidence: original[0].evidence, document: { name: 'Formularz' } })
  expect(workshopDocumentProposals(analysis, [...steps, { ...steps[0], id: 'b' }], original)).toEqual([])
  expect(workshopDocumentProposals(analysis, steps, [])).toEqual([])
  expect(workshopDocumentProposals({ ...analysis, steps: [{ ...item, reviewed: false }] }, steps, original)).toEqual([])
})

it('zachowuje ręcznie dodane dokumenty i rozpoznaje ponowne zatwierdzenie po korekcie', () => {
  const draft = documentFromActivity('HR otrzymuje raport CSV')
  const saved = { name: 'Inny dokument', direction: 'output' }
  const before = [{ id: 'a', bpmnDocuments: [saved] }]
  const corrected = { ...draft, name: 'Raport dzienny' }
  const next = applyWorkshopDocument(before, 'a', corrected, 'input:raport')
  expect(next[0].bpmnDocuments[0]).toBe(saved)
  expect(before[0].bpmnDocuments).toEqual([saved])
  expect(applyWorkshopDocument(next, 'a', corrected, 'input:raport')).toBe(next)
  expect(() => applyWorkshopDocument(next, 'a', draft, 'input:raport')).toThrow(/inne szczegóły/)
  expect(() => applyWorkshopDocument(before, 'a', { ...saved, format: 'PDF', channel: '' }, 'output:test')).toThrow(/inne szczegóły/)
})
