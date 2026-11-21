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
