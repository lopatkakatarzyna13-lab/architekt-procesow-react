import { expect, it } from 'vitest'
import { getToBeBpmnError, toBeBpmnScope } from './toBeBpmn'

it('uses generic boundaries and requires an explicit decision for alternate TO-BE paths', () => {
  const steps = [{ id: '1', name: 'Przyjęcie' }, { id: '2', name: 'Realizacja' }]
  expect(getToBeBpmnError(steps)).toBe('')
  expect(toBeBpmnScope({ processName: 'Zatrudnienie', processStart: 'Zgłoszenie', processEnd: 'Umowa' })).toEqual({ processName: 'Zatrudnienie — TO-BE', processStart: '', processEnd: '' })
  const linked = { ...steps[1], extraConnections: [{ targetId: '1', label: 'Nie' }] }
  expect(getToBeBpmnError([steps[0], linked])).toMatch(/decyzję BPMN/)
  expect(getToBeBpmnError([steps[0], { ...linked, bpmnDecision: { question: 'Gotowe?', mainLabel: 'Tak' } }])).toBe('')
  expect(getToBeBpmnError([{ ...steps[0], bpmnLane: 'HR' }, steps[1]])).not.toBe('')
})
