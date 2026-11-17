export function getDecisionBpmnError(steps) {
  if (!Array.isArray(steps) || !steps.length) return 'Dodaj i zapisz co najmniej jeden krok.'
  const ids = new Set()
  for (const step of steps) {
    if (!step || typeof step.id !== 'string' || !step.id || ids.has(step.id) || typeof step.name !== 'string' || !step.name.trim()) return 'Lista kroków jest nieprawidłowa.'
    ids.add(step.id)
  }
  for (const step of steps) {
    if (step.bpmnLane !== undefined && (typeof step.bpmnLane !== 'string' || step.bpmnLane.trim().length > 80)) return 'Nieprawidłowa nazwa toru BPMN. Sprawdź przypisania kroków.'
  }
  if (steps.some((step) => step.bpmnLane?.trim()) && steps.some((step) => !step.bpmnLane?.trim())) return 'Uzupełnij tor BPMN dla każdego kroku albo usuń wszystkie przypisania torów.'
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

