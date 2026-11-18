import { expect, it } from 'vitest'
import { compareProcessSteps } from './processStepComparison'

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
