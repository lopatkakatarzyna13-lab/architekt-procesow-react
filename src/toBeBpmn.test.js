import { expect, it } from 'vitest'
import { getToBeBpmnError, toBeBpmnScope } from './toBeBpmn'

it('uses generic boundaries and refuses to silently discard BPMN structure in a TO-BE linear export', () => {
  const steps = [{ id: '1', name: 'Przyjęcie' }, { id: '2', name: 'Realizacja' }]
  expect(getToBeBpmnError(steps)).toBe('')
  expect(toBeBpmnScope({ processName: 'Zatrudnienie', processStart: 'Zgłoszenie', processEnd: 'Umowa' })).toEqual({ processName: 'Zatrudnienie — TO-BE', processStart: '', processEnd: '' })
  expect(getToBeBpmnError([{ ...steps[0], extraConnections: [{ targetId: '2', label: 'Nie' }] }, steps[1]])).toMatch(/dodatkowych połączeń/)
  expect(getToBeBpmnError([{ ...steps[0], bpmnLane: 'HR' }, steps[1]])).toMatch(/nie obsługuje/)
})
