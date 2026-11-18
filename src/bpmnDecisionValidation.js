import { getBpmnMessages, getExternalActionPool, getExternalPools } from './bpmnMessages.js'

export function getDecisionBpmnError(steps, externalSteps = [], externalLinks = []) {
  if (!Array.isArray(steps) || !steps.length) return 'Dodaj i zapisz co najmniej jeden krok.'
  if (!Array.isArray(externalSteps) || externalSteps.some((step) => !step || typeof step.id !== 'string' || !step.id || typeof step.name !== 'string' || !step.name.trim() || step.name.trim().length > 100 || (step.participant !== undefined && (typeof step.participant !== 'string' || !step.participant.trim() || step.participant.trim().length > 100))) || new Set(externalSteps.map((step) => step.id)).size !== externalSteps.length) return 'Sprawdź listę działań zewnętrznych.'
  const externalIds = new Set(externalSteps.map((step) => step.id))
  const ids = new Set()
  for (const step of steps) {
    if (!step || typeof step.id !== 'string' || !step.id || ids.has(step.id) || typeof step.name !== 'string' || !step.name.trim()) return 'Lista kroków jest nieprawidłowa.'
    ids.add(step.id)
  }
  for (const step of steps) {
    if (step.bpmnLane !== undefined && (typeof step.bpmnLane !== 'string' || step.bpmnLane.trim().length > 80)) return 'Nieprawidłowa nazwa toru BPMN. Sprawdź przypisania kroków.'
  }
  if (steps.some((step) => step.bpmnLane?.trim()) && steps.some((step) => !step.bpmnLane?.trim())) return 'Uzupełnij tor BPMN dla każdego kroku albo usuń wszystkie przypisania torów.'
  let primaryParticipant = ''
  const messageKeys = new Set()
  for (const step of steps) {
    if (step.bpmnMessages !== undefined && !Array.isArray(step.bpmnMessages)) return 'Nieprawidłowe wiadomości BPMN. Sprawdź przekazania.'
    for (const message of step.bpmnMessages || []) {
      if (!message || [message.primary, message.external, message.label].some((value) => typeof value !== 'string' || !value.trim() || value.trim().length > 100) || !['incoming', 'outgoing'].includes(message.direction)) return 'Nieprawidłowe dane wiadomości BPMN. Sprawdź przekazania.'
      if (message.externalStepId !== undefined && (typeof message.externalStepId !== 'string' || !externalIds.has(message.externalStepId))) return 'Wiadomość wskazuje nieistniejące działanie zewnętrzne.'
      const primary = message.primary.trim().toLocaleLowerCase('pl'); const external = message.external.trim().toLocaleLowerCase('pl')
      if (primary === external || (primaryParticipant && primaryParticipant !== primary)) return 'Sprawdź nazwy basenów: własny basen musi być jeden i różny od zewnętrznego.'
      primaryParticipant = primary
      const key = JSON.stringify([step.id, external, message.direction, message.label.trim().toLocaleLowerCase('pl')])
      if (messageKeys.has(key)) return 'Usuń powtórzoną wiadomość BPMN dla tego samego kroku.'
      messageKeys.add(key)
    }
  }
  const messages = getBpmnMessages(steps)
  const pools = getExternalPools(messages)
  const poolKeys = new Set(pools.map(([key]) => key))
  if (!Array.isArray(externalLinks)) return 'Sprawdź przekazania między basenami zewnętrznymi.'
  const linkKeys = new Set()
  for (const link of externalLinks) {
    if (!link || !poolKeys.has(link.source) || !poolKeys.has(link.target) || link.source === link.target) return 'Przekazanie musi wskazywać dwa różne, istniejące baseny zewnętrzne.'
    if (typeof link.label !== 'string' || !link.label.trim() || link.label.trim().length > 100) return 'Uzupełnij nazwę przekazania między basenami.'
    const key = JSON.stringify([link.source, link.target, link.label.trim().toLocaleLowerCase('pl')])
    if (linkKeys.has(key)) return 'Usuń powtórzone przekazanie między basenami.'
    linkKeys.add(key)
  }
  const actionPools = new Map(externalSteps.map((action) => [action.id, getExternalActionPool(action, messages, pools)]))
  for (const message of messages) {
    if (message.externalStepId && actionPools.get(message.externalStepId) !== message.external.trim().toLocaleLowerCase('pl')) return 'Wiadomość wskazuje działanie z innego basenu.'
  }
  if (externalSteps.some((action) => !poolKeys.has(actionPools.get(action.id)))) return 'Przypisz działania zewnętrzne do basenów i dodaj co najmniej jedną wiadomość dla każdego użytego basenu.'
  for (const step of steps) {
    if (step.extraConnections !== undefined && !Array.isArray(step.extraConnections)) return 'Nieprawidłowe połączenia. Sprawdź proces przed eksportem.'
    const links = step.extraConnections || []
    if (!links.length) continue
    const decision = step.bpmnDecision
    if (!decision || typeof decision.question !== 'string' || !decision.question.trim() || typeof decision.mainLabel !== 'string' || !decision.mainLabel.trim()) return `Uzupełnij decyzję BPMN dla kroku „${step.name}”.`
    const names = [decision.mainLabel.trim().toLocaleLowerCase('pl')]
    for (const link of links) {
      if (!link || typeof link.targetId !== 'string' || !ids.has(link.targetId) || link.targetId === step.id || typeof link.label !== 'string' || !link.label.trim()) return `Sprawdź dodatkowe przejścia kroku „${step.name}”.`
      const label = link.label.trim().toLocaleLowerCase('pl')
      if (names.includes(label)) return `Opisy wyjść z decyzji „${step.name}” muszą się różnić.`
      names.push(label)
    }
  }
  return ''
}

