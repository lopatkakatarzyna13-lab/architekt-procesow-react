import { getLinearBpmnError } from './bpmnExport'

// The current TO-BE editor records only an ordered list. Refuse to omit any
// future BPMN metadata rather than silently turning a branching model linear.
export function getToBeBpmnError(steps) {
  const error = getLinearBpmnError(steps)
  if (error) return error
  if (steps.some((step) => step.bpmnLane || step.bpmnDecision || step.bpmnMessages?.length)) return 'Mapa TO-BE zawiera dane BPMN, których ten wariant liniowy nie obsługuje.'
  return ''
}

export function toBeBpmnScope(scope) {
  return { processName: `${scope.processName?.trim() || 'Proces'} — TO-BE`, processStart: '', processEnd: '' }
}
