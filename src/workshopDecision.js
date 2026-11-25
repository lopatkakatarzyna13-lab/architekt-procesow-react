import { addProcessConnection, setNextProcessStep, setProcessDecision } from './processConnections.js'
import { getDecisionBpmnError } from './bpmnDecisionValidation.js'

const missing = /brakuj|brak(?:i|ach|ów|u)?\b|niekomplet|nie zgadzaj|nie (?:są|jest) (?:kompletn|zgodn|poprawn)/iu
const control = /(?:sprawdz|weryfikuj|porównuj).*(?:komplet|zgodn|rejestr|wersj)/iu
const retry = /ponown\p{L}* (?:sprawdz|kontrol|weryfik)|jeszcze raz sprawdz/iu
const back = /(?<!\p{L})(?:wraca|wracają|z powrotem)(?!\p{L})/iu
const repair = /zwrac|odsył|uzupełni|poprawi/iu
const success = /(?:gdy|kiedy|jeśli|jeżeli) [^,]*(?:są kompletne|jest kompletne|jest kompletny|są zgodne|jest poprawne|nie ma braków)[^,]*,/iu

function completeCase(text) {
  const condition = text.split(',', 1)[0]
  return success.test(text) && !/(?:\bnie\s+(?:są|jest)|brakuje|niekomplet|niezgod|\balbo\b|\blub\b)/iu.test(condition)
}

const normalized = (value) => value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pl')

export function proposeWorkshopDecision(analysis, steps, transcript) {
  if (analysis?.source !== 'local-transcript' || steps.length < 3) return null
  const items = analysis.steps.filter((item) => item.evidence && transcript.includes(item.evidence))
  const rechecks = items.filter((item) => retry.test(item.text) || back.test(item.text))
  if (rechecks.length !== 1) return null
  const recheck = rechecks[0]
  const before = items.slice(0, items.indexOf(recheck))
  const controls = before.filter((item) => control.test(item.text) && !/^(?:gdy|kiedy|jeśli|jeżeli) /iu.test(item.text))
  const lastControl = controls.at(-1)
  const afterControl = before.slice(lastControl ? before.indexOf(lastControl) + 1 : 0)
  const repairs = afterControl.filter((item) => repair.test(item.text) && !control.test(item.text))
  if (!repairs.length && !back.test(recheck.text)) return null
  const successes = items.filter((item) => completeCase(item.text))
  const problems = [...analysis.questions, ...analysis.exceptions].filter((item) =>
    item.evidence && transcript.includes(item.evidence) && missing.test(item.evidence))
  if (!problems.length && !successes.length) return null
  function stepId(item) {
    if (!item?.reviewed) return ''
    const matches = steps.filter((step) => normalized(step.name) === normalized(item.text))
    return matches.length === 1 ? matches[0].id : ''
  }
  const source = controls.length === 1 ? controls[0] : null
  const positive = successes.length === 1 ? successes[0] : null
  const firstRepair = repairs[0] ?? recheck
  const evidence = [...new Set([source, ...problems, firstRepair, recheck, positive]
    .filter(Boolean).map((item) => item.evidence))]
  return {
    evidence,
    sourceId: stepId(source),
    mainId: stepId(positive),
    otherId: stepId(firstRepair),
    returnFrom: stepId(recheck),
    returnToDecision: Boolean(stepId(source) && stepId(recheck) && /(?:ponownie|jeszcze raz) (?:sprawdz|weryfik)/iu.test(recheck.text)),
    returnTo: retry.test(recheck.text) ? stepId(source) : '',
    question: source && /komplet/iu.test(source.text) ? 'Czy dane są kompletne?' : 'Czy wynik kontroli jest poprawny?',
    mainLabel: 'Tak',
    otherLabel: 'Nie',
  }
}

export function applyWorkshopDecision(steps, draft) {
  const { sourceId, mainId, otherId, returnFrom, returnTo, question, mainLabel, otherLabel } = draft
  const byId = new Map(steps.map((step) => [step.id, step]))
  if (![sourceId, mainId, otherId, returnFrom, returnTo].every((id) => byId.has(id))) throw new Error('Wskaż wszystkie kroki, w tym cel powrotu.')
  if (new Set([sourceId, mainId, otherId]).size !== 3 || [mainId, sourceId].includes(returnFrom) || returnFrom === returnTo) throw new Error('Sprawdź przebieg obu ścieżek i kierunek powrotu.')
  if (normalized(mainLabel) === normalized(otherLabel)) throw new Error('Nazwij oba wyjścia z decyzji różnie.')
  const toDecision = draft.returnToDecision === true
  if (toDecision && returnTo !== sourceId) throw new Error('Wskaż krok z decyzją jako cel powrotu.')
  const source = byId.get(sourceId)
  const links = source.extraConnections ?? []
  const matchingLink = links.find((link) => link.targetId === otherId && link.label === otherLabel.trim())
  if (source.nextIsDecision || (source.nextStepId && source.nextStepId !== mainId) ||
      (byId.get(returnFrom).nextStepId && byId.get(returnFrom).nextStepId !== returnTo) ||
      links.some((link) => link !== matchingLink) ||
      (source.bpmnDecision && (source.bpmnDecision.question !== question.trim() || source.bpmnDecision.mainLabel !== mainLabel.trim()))) {
    throw new Error('Propozycja koliduje z zapisanym przebiegiem. Sprawdź istniejące połączenia w edytorze.')
  }
  if (matchingLink && source.nextStepId === mainId && byId.get(returnFrom).nextStepId === returnTo && Boolean(byId.get(returnFrom).nextIsDecision) === toDecision && source.bpmnDecision) return steps
  let next = setNextProcessStep(steps, sourceId, mainId)
  if (!matchingLink) next = addProcessConnection(next, sourceId, otherId, otherLabel)
  next = setProcessDecision(next, sourceId, question, mainLabel)
  next = setNextProcessStep(next, returnFrom, returnTo, toDecision)
  // Validate just this graph. External pools and task metadata have their own editors.
  const graph = next.map(({ id, name, nextStepId, nextIsDecision, extraConnections, bpmnDecision }) => ({ id, name, nextStepId, nextIsDecision, extraConnections, bpmnDecision }))
  const error = getDecisionBpmnError(graph)
  if (error) throw new Error(error)
  return next
}
