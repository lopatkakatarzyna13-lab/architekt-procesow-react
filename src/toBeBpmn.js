import { getDecisionBpmnError } from './bpmnDecisionValidation'

export function getToBeBpmnError(steps) {
  const error = getDecisionBpmnError(steps)
  if (error) return error
  if (steps.some((step) => step.bpmnLane || step.bpmnMessages?.length)) return 'Mapa TO-BE nie obsługuje jeszcze torów ani wiadomości.'
  return ''
}

export function toBeBpmnScope(scope) {
  return { processName: `${scope.processName?.trim() || 'Proces'} — TO-BE`, processStart: '', processEnd: '' }
}
