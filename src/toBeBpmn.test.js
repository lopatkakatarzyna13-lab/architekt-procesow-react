import { expect, it } from 'vitest'
import { toBeBpmnScope } from './toBeBpmn'

it('uses generic boundaries independently of the AS-IS process', () => {
  expect(toBeBpmnScope({ processName: 'Zatrudnienie', processStart: 'Zgłoszenie', processEnd: 'Umowa' })).toEqual({
    processName: 'Zatrudnienie — TO-BE', processStart: '', processEnd: '',
  })
})
