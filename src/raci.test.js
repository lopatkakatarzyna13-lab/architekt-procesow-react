import { describe, expect, it } from 'vitest'
import { getChangedRaciOwners, getMissingRaciOwners, getRaciOwnerAssignments, getRaciOwnersByStep, getRaciValidationErrors } from './raci'

const steps = [{ id: 'step-1' }]
const responsibleError = 'Krok musi mieć przynajmniej jedną rolę Responsible (R).'
const accountableMissingError = 'Krok musi mieć dokładnie jedną rolę Accountable (A).'
const accountableMultipleError = 'Krok powinien mieć tylko jedną rolę Accountable (A).'

it('uzupełnia R/A w pustym wierszu lub obok C/I, chroniąc istniejące przypisania', () => {
  const steps = [
    { id: 'empty', owner: ' kadry ' },
    { id: 'manual', owner: 'Kadry' },
    { id: 'consulted-owner', owner: 'Kadry' },
    { id: 'responsible', owner: 'Kadry' },
    { id: 'accountable', owner: 'Kadry' },
    { id: 'missing' },
    { id: 'unknown', owner: 'Finanse' },
    { id: 'ambiguous', owner: 'IT' },
  ]
  const stakeholders = [
    { id: 'hr', name: 'Kadry' },
    { id: 'it-a', name: 'IT' },
    { id: 'it-b', name: 'it' },
  ]
  const raci = {
    empty: { hr: '' },
    manual: { 'it-a': 'C', 'it-b': 'I' },
    'consulted-owner': { hr: 'C' },
    responsible: { 'it-a': 'R' },
    accountable: { 'it-b': 'A' },
  }

  expect(getRaciOwnerAssignments(steps, stakeholders, raci)).toEqual({ empty: { hr: 'RA' }, manual: { hr: 'RA' } })
})

it('zbiera brakujące role bez powtórzeń tylko z kroków kwalifikujących się do uzupełnienia', () => {
  const steps = [
    { id: 'known', owner: ' kadry ' },
    { id: 'new', owner: ' Automatyzacja HR ' },
    { id: 'again', owner: 'automatyzacja hr' },
    { id: 'handled', owner: 'Finanse' },
    { id: 'unspecified' },
  ]
  const stakeholders = [{ id: 'hr', name: 'Kadry' }]
  const raci = { new: { hr: 'I' }, handled: { hr: 'RA' } }
  expect(getMissingRaciOwners(steps, stakeholders, raci)).toEqual(['Automatyzacja HR'])
})

it('wskazuje zmiany ról dla tych samych kroków względem zapisanego raportu', () => {
  const previous = getRaciOwnersByStep([
    { id: 'same', owner: 'Kadry' },
    { id: 'changed', owner: 'HR' },
    { id: 'removed' },
    { id: 'assigned' },
  ])
  const updated = [
    { id: 'same', owner: ' kadry ', name: 'Zmieniona nazwa kroku' },
    { id: 'changed' },
    { id: 'assigned', owner: 'IT' },
    { id: 'new', owner: 'IT' },
  ]
  expect(getChangedRaciOwners(updated, previous)).toEqual({
    changed: { previous: 'HR', current: '' },
    assigned: { previous: '', current: 'IT' },
  })
  expect(getChangedRaciOwners(updated, getRaciOwnersByStep(updated))).toEqual({})
})

function validate(...assignments) {
  const raci = {
    'step-1': Object.fromEntries(
      assignments.map((value, index) => [`stakeholder-${index + 1}`, value]),
    ),
  }

  return getRaciValidationErrors(steps, raci)
}

describe('getRaciValidationErrors', () => {
  it('uznaje pojedyncze RA za jednoczesne przypisanie R i A', () => {
    expect(validate('RA')).toEqual({})
  })

  it('akceptuje RA razem z dodatkowym R', () => {
    expect(validate('RA', 'R')).toEqual({})
  })

  it.each([
    ['RA razem z A', ['RA', 'A']],
    ['dwa przypisania RA', ['RA', 'RA']],
    ['dwa przypisania A', ['R', 'A', 'A']],
  ])('zgłasza nadmiar ról A dla przypadku: %s', (_name, assignments) => {
    expect(validate(...assignments)['step-1']).toContain(accountableMultipleError)
  })

  it('zgłasza brak R, gdy występuje A bez R lub RA', () => {
    expect(validate('A', 'C', 'I')['step-1']).toContain(responsibleError)
  })

  it('zgłasza brak A, gdy występuje R bez A lub RA', () => {
    expect(validate('R', 'C', 'I')['step-1']).toContain(accountableMissingError)
  })

  it('zachowuje zgodność z poprawnym klasycznym przypisaniem RACI', () => {
    expect(validate('R', 'A', 'C', 'I')).toEqual({})
  })

  it('waliduje każdy krok niezależnie', () => {
    const result = getRaciValidationErrors(
      [{ id: 'valid' }, { id: 'invalid' }],
      {
        valid: { first: 'RA' },
        invalid: { first: 'C' },
      },
    )

    expect(result.valid).toBeUndefined()
    expect(result.invalid).toEqual([responsibleError, accountableMissingError])
  })
})
