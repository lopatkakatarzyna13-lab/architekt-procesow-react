import { expect, it } from 'vitest'
import { getDecisionBpmnError } from './bpmnDecisionValidation'
import { copyAsIsBpmn, toBeBpmnScope } from './toBeBpmn'

it('uses generic boundaries independently of the AS-IS process', () => {
  expect(toBeBpmnScope({ processName: 'Zatrudnienie', processStart: 'Zgłoszenie', processEnd: 'Umowa' })).toEqual({
    processName: 'Zatrudnienie — TO-BE', processStart: '', processEnd: '',
  })
})

it('remaps explicitly selected next steps when copying a process with a return', () => {
  const steps = [
    { id: 'a', name: 'Sprawdzenie', nextStepId: 'c', extraConnections: [{ targetId: 'b', label: 'Brak' }],
      bpmnDecision: { question: 'Czy kompletne?', mainLabel: 'Tak' } },
    { id: 'b', name: 'Uzupełnienie', nextStepId: 'a' },
    { id: 'c', name: 'Zatwierdzenie' },
  ]
  const copies = steps.map(({ name }, index) => ({ id: `copy-${index}`, name }))
  const result = copyAsIsBpmn(steps, [], [], copies)
  expect(result.steps.map((step) => step.nextStepId)).toEqual(['copy-2', 'copy-0', undefined])
  expect(getDecisionBpmnError(result.steps)).toBe('')
})


it('copies gateways, lanes and cross-pool links with new step and action references', () => {
  const steps = [
    { id: 'a', name: 'Kontrola', bpmnLane: 'HR', bpmnMessages: [
      { primary: 'Firma', external: 'Biuro', label: 'Dokument', direction: 'outgoing', externalStepId: 'ca' },
      { primary: 'Firma', external: 'Bank', label: 'Potwierdzenie', direction: 'incoming' },
    ] },
    { id: 'b', name: 'Przekazanie', bpmnLane: 'Kadry',
      extraConnections: [{ targetId: 'a', label: 'Brak danych' }],
      bpmnDecision: { question: 'Czy dane są kompletne?', mainLabel: 'Kompletne' },
    },
  ]
  const externalSteps = [
    { id: 'ca', name: 'Odbierz dokument', participant: 'Biuro' },
    { id: 'cb', name: 'Potwierdź', participant: 'Bank' },
  ]
  const externalLinks = [
    { source: 'biuro', target: 'bank', sourceActionId: 'ca', targetActionId: 'cb', label: 'Dane do potwierdzenia' },
    { source: 'bank', target: 'biuro', label: 'Odpowiedź' },
  ]
  const copies = steps.map(({ name }, index) => ({ id: `to-be-${index}`, name }))
  const result = copyAsIsBpmn(steps, externalSteps, externalLinks, copies)
  expect(getDecisionBpmnError(result.steps, result.externalSteps, result.externalLinks)).toBe('')
  expect(result.steps[1].extraConnections[0].targetId).toBe('to-be-0')
  expect(result.steps.map((step) => step.bpmnLane)).toEqual(['HR', 'Kadry'])
  expect(result.externalSteps[0].id).not.toBe('ca')
  expect(result.steps[0].bpmnMessages[0].externalStepId).toBe(result.externalSteps[0].id)
  expect(result.externalLinks[0]).toMatchObject({
    sourceActionId: result.externalSteps[0].id, targetActionId: result.externalSteps[1].id,
  })
  expect(result.externalLinks[1]).toEqual(externalLinks[1])
  result.steps[1].bpmnDecision.question = 'Pytanie docelowe'
  expect(steps[1].bpmnDecision.question).toBe('Czy dane są kompletne?')
  expect(() => copyAsIsBpmn(steps, externalSteps, [{ ...externalLinks[0], targetActionId: 'missing' }], copies))
    .toThrow('Przekazanie wskazuje brakujące działanie')
})
