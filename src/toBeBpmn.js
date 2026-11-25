import { getDecisionBpmnError, getDecisionGraphError } from './bpmnDecisionValidation.js'
import { addProcessConnection, setNextProcessStep, setProcessDecision } from './processConnections.js'
import { isFormValidationStep } from './toBeSuggestions.js'

export const formDecision = {
  question: 'Czy zgłoszenie jest kompletne?',
  mainLabel: 'Tak — dane kompletne',
  returnLabel: 'Nie — uzupełnij dane',
}

export function canProposeFormDecision(step) {
  return isFormValidationStep(step) && !step.bpmnDecision && !step.extraConnections?.length && !step.nextIsDecision
}

export function applyFormDecision(steps, sourceId, mainId, returnId) {
  const source = steps.find((step) => step.id === sourceId)
  if (!source || !canProposeFormDecision(source)) throw new Error('Sprawdź istniejące połączenia kroku walidacji.')
  if (!mainId || !returnId || mainId === returnId) throw new Error('Wskaż dwa różne cele decyzji.')
  let next = setNextProcessStep(steps, sourceId, mainId)
  next = addProcessConnection(next, sourceId, returnId, formDecision.returnLabel)
  next = setProcessDecision(next, sourceId, formDecision.question, formDecision.mainLabel)
  const error = getDecisionGraphError(next)
  if (error) throw new Error(error)
  return next
}

export function toBeBpmnScope(scope) {
  return { processName: `${scope.processName?.trim() || 'Proces'} — TO-BE`, processStart: '', processEnd: '' }
}

export function copyAsIsBpmn(steps, externalSteps, externalLinks, copiedSteps) {
  const error = getDecisionBpmnError(steps, externalSteps, externalLinks)
  if (error) throw new Error(error)

  const stepIds = new Map(steps.map((step, index) => [step.id, copiedSteps[index].id]))
  const actionIds = new Map(externalSteps.map((action, index) => [action.id, `as-is-action-copy-${action.id}-${index}`]))

  return {
    steps: copiedSteps.map((copy, index) => {
      const { nextStepId, nextIsDecision, extraConnections, bpmnDecision, bpmnLane, bpmnMessages } = steps[index]
      return {
        ...copy,
        ...(nextStepId && { nextStepId: stepIds.get(nextStepId) }),
        ...(nextIsDecision && { nextIsDecision }),
        ...(extraConnections?.length && {
          extraConnections: extraConnections.map((link) => ({ ...link, targetId: stepIds.get(link.targetId) })),
          bpmnDecision: { ...bpmnDecision },
        }),
        ...(bpmnLane !== undefined && { bpmnLane }),
        ...(bpmnMessages?.length && {
          bpmnMessages: bpmnMessages.map(({ externalStepId, ...message }) => ({
            ...message,
            ...(externalStepId !== undefined && { externalStepId: actionIds.get(externalStepId) }),
          })),
        }),
      }
    }),
    externalSteps: externalSteps.map((action) => ({ ...action, id: actionIds.get(action.id) })),
    externalLinks: externalLinks.map(({ sourceActionId, targetActionId, ...link }) => ({
      ...link,
      ...(sourceActionId !== undefined && { sourceActionId: actionIds.get(sourceActionId) }),
      ...(targetActionId !== undefined && { targetActionId: actionIds.get(targetActionId) }),
    })),
  }
}
