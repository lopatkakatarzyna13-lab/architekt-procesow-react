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

export function removeProcessConnection(steps, sourceId, index) {
  return steps.map((step) => step.id === sourceId && Array.isArray(step.extraConnections)
    ? { ...step, extraConnections: step.extraConnections.filter((_, i) => i !== index) } : step)
}

export function removeStepConnections(steps, removedId) {
  return steps.filter((step) => step.id !== removedId).map((step) => Array.isArray(step.extraConnections)
    ? { ...step, extraConnections: step.extraConnections.filter((link) => link.targetId !== removedId) } : step)
}

export function getProcessConnections(steps) {
  const ids = new Set(steps.map((step) => step.id))
  return steps.flatMap((step) => (Array.isArray(step.extraConnections) ? step.extraConnections : [])
    .flatMap((link, index) => link && ids.has(link.targetId) && link.targetId !== step.id && typeof link.label === 'string' && link.label.trim()
      ? [{ sourceId: step.id, targetId: link.targetId, label: link.label, index }] : []))
}
