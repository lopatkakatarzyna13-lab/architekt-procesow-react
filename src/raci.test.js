import { describe, expect, it } from 'vitest'
import { getRaciValidationErrors } from './raci'

const steps = [{ id: 'step-1' }]
const responsibleError = 'Krok musi mieć przynajmniej jedną rolę Responsible (R).'
const accountableMissingError = 'Krok musi mieć dokładnie jedną rolę Accountable (A).'
const accountableMultipleError = 'Krok powinien mieć tylko jedną rolę Accountable (A).'

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
