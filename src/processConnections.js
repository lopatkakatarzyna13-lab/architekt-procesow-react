// Additional paths supplement the existing ordered sequence. They are not BPMN gateways.
export function addProcessConnection(steps, sourceId, targetId, label) {
  const source = steps.find((step) => step.id === sourceId)
  const target = steps.find((step) => step.id === targetId)
  const name = typeof label === 'string' ? label.trim() : ''
  if (!source || !target || sourceId === targetId) throw new Error('Wybierz dwa różne istniejące kroki.')
  if (!name || name.length > 120) throw new Error('Podaj opis połączenia (maksymalnie 120 znaków).')
  const links = Array.isArray(source.extraConnections) ? source.extraConnections : []
  if (links.some((link) => link.targetId === targetId && link.label === name)) throw new Error('Takie połączenie już istnieje.')
  return steps.map((step) => step.id === sourceId ? { ...step, extraConnections: [...links, { targetId, label: name }] } : step)
}

function clearMissingDecisionTargets(steps) {
  const decisions = new Set(steps.filter((step) => step.extraConnections?.length && step.bpmnDecision).map((step) => step.id))
  return steps.map((step) => {
    if (!step.nextIsDecision || decisions.has(step.nextStepId)) return step
    const updated = { ...step }
    delete updated.nextIsDecision
    return updated
  })
}

export function removeProcessConnection(steps, sourceId, index) {
  return clearMissingDecisionTargets(steps.map((step) => step.id === sourceId && Array.isArray(step.extraConnections)
    ? { ...step, extraConnections: step.extraConnections.filter((_, i) => i !== index) } : step))
}

export function removeStepConnections(steps, removedId) {
  return clearMissingDecisionTargets(steps.filter((step) => step.id !== removedId).map((step) => {
    const { nextStepId, extraConnections } = step
    const remaining = Array.isArray(extraConnections)
      ? { ...step, extraConnections: extraConnections.filter((link) => link.targetId !== removedId) } : { ...step }
    if (nextStepId === removedId) delete remaining.nextStepId
    return remaining
  }))
}

export function setNextProcessStep(steps, sourceId, targetId, toDecision = false) {
  if (!steps.some((step) => step.id === sourceId) ||
      (targetId !== '' && (sourceId === targetId || !steps.some((step) => step.id === targetId)))) {
    throw new Error('Wybierz dwa różne istniejące kroki albo kolejność z listy.')
  }
  const target = steps.find((step) => step.id === targetId)
  if (toDecision && !(target?.bpmnDecision && target.extraConnections?.length)) throw new Error('Wybierz krok z zapisaną decyzją.')
  return steps.map((step) => {
    if (step.id !== sourceId) return step
    const updated = { ...step }
    if (toDecision) updated.nextIsDecision = true
    else delete updated.nextIsDecision
    if (targetId) updated.nextStepId = targetId
    else delete updated.nextStepId
    return updated
  })
}

export function describeNextTarget(steps, step) {
  const target = steps.find((item) => item.id === step.nextStepId)
  return step.nextIsDecision && target?.bpmnDecision ? 'Decyzja: ' + target.bpmnDecision.question : target?.name || 'Nieznany krok'
}

export function getNextProcessStepId(steps, index) {
  return steps[index].nextStepId ?? steps[index + 1]?.id
}

export function getProcessConnections(steps) {
  const ids = new Set(steps.map((step) => step.id))
  return steps.flatMap((step) => (Array.isArray(step.extraConnections) ? step.extraConnections : [])
    .flatMap((link, index) => link && ids.has(link.targetId) && link.targetId !== step.id && typeof link.label === 'string' && link.label.trim()
      ? [{ sourceId: step.id, targetId: link.targetId, label: link.label, index }] : []))
}

export function setProcessDecision(steps, sourceId, question, mainLabel) {
  const step = steps.find((item) => item.id === sourceId)
  if (!step || !Array.isArray(step.extraConnections) || step.extraConnections.length === 0) throw new Error('Najpierw dodaj inne przejście z tego kroku.')
  if (typeof question !== 'string' || !question.trim() || question.trim().length > 120 || typeof mainLabel !== 'string' || !mainLabel.trim() || mainLabel.trim().length > 120) throw new Error('Uzupełnij pytanie decyzji i opis podstawowej ścieżki (do 120 znaków).')
  return steps.map((item) => item.id === sourceId ? { ...item, bpmnDecision: { question: question.trim(), mainLabel: mainLabel.trim() } } : item)
}

export function setProcessLane(steps, sourceId, laneName) {
  if (!steps.some((step) => step.id === sourceId)) throw new Error('Nie znaleziono kroku.')
  if (typeof laneName !== 'string' || laneName.trim().length > 80) throw new Error('Nazwa toru może mieć maksymalnie 80 znaków.')
  return steps.map((step) => step.id === sourceId ? { ...step, bpmnLane: laneName.trim() } : step)
}
