const norm = (value) => value.trim().toLocaleLowerCase('pl')

export function getBpmnMessages(steps) {
  return steps.flatMap((step) => (Array.isArray(step.bpmnMessages) ? step.bpmnMessages : [])
    .map((message, index) => ({ ...(message || {}), stepId: step.id, index })))
}

export function getExternalPools(messages) {
  return [...new Map(messages.filter(({ external }) => typeof external === 'string' && external.trim()).map(({ external }) => [norm(external), external.trim()])).entries()]
}

export function getExternalActionPool(action, messages, pools = getExternalPools(messages)) {
  if (action.participant) return norm(action.participant)
  const linked = messages.find((message) => message.externalStepId === action.id && typeof message.external === 'string')
  return linked ? norm(linked.external) : pools.length === 1 ? pools[0][0] : ''
}

export function addBpmnMessage(steps, stepId, mainParticipant, externalParticipant, direction, label, externalStepId = '', externalSteps = []) {
  if (externalStepId && !externalSteps.some((item) => item.id === externalStepId)) throw new Error('Wybierz istniejące działanie zewnętrzne.')
  const step = steps.find((item) => item.id === stepId)
  const values = [mainParticipant, externalParticipant, label]
  if (!step || values.some((value) => typeof value !== 'string' || !value.trim() || value.trim().length > 100)) throw new Error('Wybierz krok i uzupełnij nazwy basenów oraz wiadomości (do 100 znaków).')
  if (!['outgoing', 'incoming'].includes(direction)) throw new Error('Wybierz kierunek przekazania wiadomości.')
  const primary = mainParticipant.trim(); const external = externalParticipant.trim(); const name = label.trim()
  if (norm(primary) === norm(external)) throw new Error('Baseny muszą mieć różne nazwy.')
  if (steps.some((item) => item.bpmnMessages !== undefined && !Array.isArray(item.bpmnMessages))) throw new Error('Zapis wiadomości jest nieprawidłowy; nie dodano nowej pozycji.')
  const messages = getBpmnMessages(steps)
  if (messages.some((item) => typeof item.primary !== 'string' || typeof item.external !== 'string' || typeof item.label !== 'string')) throw new Error('Zapis wiadomości jest nieprawidłowy; nie dodano nowej pozycji.')
  const action = externalSteps.find((item) => item.id === externalStepId)
  if (action && ((action.participant && norm(action.participant) !== norm(external)) ||
    messages.some((item) => item.externalStepId === action.id && norm(item.external) !== norm(external)))) {
    throw new Error('Wybierz działanie należące do basenu wskazanego w wiadomości.')
  }
  if (messages.some((item) => norm(item.primary) !== norm(primary))) throw new Error('Nazwa basenu własnego procesu musi być taka sama we wszystkich wiadomościach.')
  if (messages.some((item) => item.stepId === stepId && norm(item.external) === norm(external) && item.direction === direction && norm(item.label) === norm(name))) throw new Error('Taka wiadomość już istnieje dla tego kroku.')
  const old = Array.isArray(step.bpmnMessages) ? step.bpmnMessages : []
  return steps.map((item) => item.id === stepId ? { ...item, bpmnMessages: [...old, { primary, external, direction, label: name, ...(externalStepId ? { externalStepId } : {}) }] } : item)
}

export function removeBpmnMessage(steps, stepId, index) {
  return steps.map((step) => step.id === stepId && Array.isArray(step.bpmnMessages)
    ? { ...step, bpmnMessages: step.bpmnMessages.filter((_, i) => i !== index) } : step)
}
