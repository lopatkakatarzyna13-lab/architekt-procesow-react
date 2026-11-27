import { expect, it } from 'vitest'
import { compareProcessSteps, getMissingToBeSteps } from './processStepComparison'

it('compares tracked fields by source, keeps legacy copies linked and does not match names alone', () => {
  const asIs = [
    { id: 'a-7', name: 'Kontrola danych', owner: 'Kadry', system: 'SAP' },
    { id: 'b', name: 'Przekazanie', owner: 'Biuro', system: '' },
    { id: 'c', name: 'Zatwierdzenie' },
  ]
  const toBe = [
    { id: 'explicit', sourceAsIsStepId: 'a-7', name: 'Kontrola kompletu', owner: 'HR', system: 'Portal' },
    { id: 'as-is-copy-b-1', name: 'Przekazanie', owner: 'Biuro ', system: '' },
    { id: 'unlinked', name: 'Zatwierdzenie' },
  ]
  expect(compareProcessSteps(asIs, toBe)).toEqual({
    changed: [{
      id: 'explicit', name: 'Kontrola kompletu',
      differences: [
        { field: 'name', label: 'Nazwa', before: 'Kontrola danych', after: 'Kontrola kompletu' },
        { field: 'owner', label: 'Odpowiedzialność', before: 'Kadry', after: 'HR' },
        { field: 'system', label: 'System', before: 'SAP', after: 'Portal' },
      ],
    }],
    unmatchedAsIs: [asIs[2]],
    unmatchedToBe: [toBe[2]],
  })
})

it('keeps a copied step visible when its source was removed', () => {
  const toBe = [{ id: 'as-is-copy-removed-0', name: 'Kontrola' }]
  expect(compareProcessSteps([], toBe)).toEqual({
    changed: [], unmatchedAsIs: [], unmatchedToBe: toBe,
  })
})

it('treats source links and existing names as individual matches when choosing steps to copy', () => {
  const asIs = [
    { id: 'a', name: 'Kontrola danych' },
    { id: 'b', name: 'Kontrola danych' },
    { id: 'c', name: 'Kontrola danych' },
    { id: 'send', name: 'Wysyłka skierowania' },
  ]
  const toBe = [
    { id: 'as-is-copy-b-1', name: 'Kontrola po walidacji' },
    { id: 'new', name: ' KONTROLA   DANYCH ' },
    { id: 'as-is-copy-removed-1', name: 'Wysyłka skierowania' },
  ]
  expect(getMissingToBeSteps(asIs, toBe)).toEqual([asIs[2]])
})

it('reports changed decision wording and destinations while recognising copied message endpoints', () => {
  const message = { primary: 'Firma', external: 'Poradnia', direction: 'outgoing', label: 'Skierowanie' }
  const asIs = [
    { id: 'form', name: 'Zgłoszenie' },
    { id: 'verify', name: 'Kontrola', bpmnDecision: { question: 'Czy kompletne?', mainLabel: 'Tak' },
      extraConnections: [{ targetId: 'form', label: 'Nie' }] },
    { id: 'send', name: 'Wyślij', bpmnMessages: [{ ...message, externalStepId: 'old-receipt' }] },
  ]
  const toBe = [
    { id: 'new-form', name: 'Formularz', sourceAsIsStepId: 'form' },
    { ...asIs[1], id: 'new-verify', sourceAsIsStepId: 'verify',
      bpmnDecision: { question: 'Czy dane stanowiska są kompletne?', mainLabel: 'Tak' },
      extraConnections: [{ targetId: 'new-form', label: 'Nie — uzupełnij' }] },
    { ...asIs[2], id: 'new-send', sourceAsIsStepId: 'send', bpmnMessages: [{ ...message, externalStepId: 'new-receipt' }] },
  ]
  const actions = {
    asIsExternalSteps: [{ id: 'old-receipt', name: 'Odbierz skierowanie' }],
    toBeExternalSteps: [{ id: 'new-receipt', name: 'Odbierz skierowanie' }],
  }
  const comparison = compareProcessSteps(asIs, toBe, actions)
  expect(comparison.changed[1].differences).toEqual([
    { field: 'bpmnDecisionQuestion', label: 'Pytanie decyzji BPMN', before: 'Czy kompletne?', after: 'Czy dane stanowiska są kompletne?' },
    { field: 'bpmnDecisionBranches', label: 'Dodatkowe ścieżki decyzji', before: 'Nie → Zgłoszenie', after: 'Nie — uzupełnij → Formularz' },
  ])
  expect(comparison.changed).toHaveLength(2)

  const changedRoute = [
    toBe[0],
    { ...toBe[1], nextStepId: 'new-form', extraConnections: [{ targetId: 'new-send', label: 'Nie' }] },
    { ...toBe[2], bpmnMessages: [{ ...message, direction: 'incoming', externalStepId: 'new-receipt' }] },
  ]
  const changed = compareProcessSteps(asIs, changedRoute, actions).changed
  expect(changed[1].differences).toEqual(expect.arrayContaining([
    expect.objectContaining({ field: 'bpmnDecisionMain', before: 'Tak → Wyślij', after: 'Tak → Formularz' }),
    expect.objectContaining({ field: 'bpmnDecisionBranches', before: 'Nie → Zgłoszenie', after: 'Nie → Wyślij' }),
  ]))
  expect(changed[2].differences[0]).toMatchObject({
    before: 'Firma → Poradnia / Odbierz skierowanie — Skierowanie',
    after: 'Poradnia / Odbierz skierowanie → Firma — Skierowanie',
  })
})
