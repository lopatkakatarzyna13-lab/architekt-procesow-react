import { getDecisionBpmnError, getDecisionGraphError } from './bpmnDecisionValidation.js'
import { addProcessConnection, getNextProcessStepId, setNextProcessStep, setProcessDecision } from './processConnections.js'
import { sourceStepId } from './processStepComparison.js'
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

export function getReusableAsIsDecisions(steps, asIsSteps) {
  const targetBySource = new Map()
  for (const step of steps) {
    const id = sourceStepId(step)
    if (id) targetBySource.set(id, targetBySource.has(id) ? null : step)
  }

  return asIsSteps.flatMap((source, index) => {
    const decision = source.bpmnDecision
    const step = targetBySource.get(source.id)
    if (!decision || !source.extraConnections?.length || !step || step.bpmnDecision || step.extraConnections?.length || step.nextStepId) return []
    const sourceNextId = getNextProcessStepId(asIsSteps, index)
    const main = targetBySource.get(sourceNextId)
    if (sourceNextId ? !main : step !== steps.at(-1)) return []
    if (source.nextIsDecision && !(main?.bpmnDecision && main.extraConnections?.length)) return []
    const branches = source.extraConnections.map(({ targetId, label }) => ({ target: targetBySource.get(targetId), label }))
    if (branches.some(({ target }) => !target)) return []
    return [{ source, step, main, branches }]
  })
}

export function applyAsIsDecision(steps, asIsSteps, sourceId, { question, mainLabel, branchLabels }) {
  const proposal = getReusableAsIsDecisions(steps, asIsSteps).find(({ source }) => source.id === sourceId)
  if (!proposal || branchLabels.length !== proposal.branches.length) throw new Error('Sprawdź powiązane kroki i istniejące decyzje TO-BE.')

  const { source, step, main, branches } = proposal
  let next = main ? setNextProcessStep(steps, step.id, main.id, Boolean(source.nextIsDecision)) : steps
  for (const [index, branch] of branches.entries()) {
    next = addProcessConnection(next, step.id, branch.target.id, branchLabels[index])
  }
  next = setProcessDecision(next, step.id, question, mainLabel)
  const error = getDecisionGraphError(next)
  if (error) throw new Error(error)
  return next
}

export function toBeBpmnScope(scope) {
  return { ...scope, processName: `${scope.processName?.trim() || 'Proces'} — TO-BE`, processStart: '', processEnd: '' }
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
