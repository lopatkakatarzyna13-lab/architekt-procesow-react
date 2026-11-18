import { getDecisionBpmnError } from './bpmnDecisionValidation.js'

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
      const { extraConnections, bpmnDecision, bpmnLane, bpmnMessages } = steps[index]
      return {
        ...copy,
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
