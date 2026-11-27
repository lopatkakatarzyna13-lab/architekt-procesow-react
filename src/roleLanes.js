import { getBpmnMessages, getExternalPools } from './bpmnMessages.js'

const clean = (value) => typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
const key = (value) => clean(value).toLocaleLowerCase('pl')
const ownerKey = (step) => key(step.owner)
const taskOwnerKey = (step) => `${step.bpmnTaskType === 'service' ? 'service' : 'other'}:${ownerKey(step)}`

function getOwnerLanes(steps, assignmentKey) {
  const ownerLanes = new Map()
  for (const step of steps) {
    const lane = typeof step.bpmnLane === 'string' ? step.bpmnLane.trim() : ''
    if (!lane || !ownerKey(step)) continue
    const owner = assignmentKey(step)
    if (!ownerLanes.has(owner)) ownerLanes.set(owner, new Set())
    ownerLanes.get(owner).add(lane)
  }
  return ownerLanes
}

export function proposeRoleLanes(steps, externalSteps = [], asIsSteps) {
  const external = new Set(getExternalPools(getBpmnMessages(steps)).map(([, name]) => key(name)))
  for (const action of externalSteps) external.add(key(action.participant))
  const asIsLanes = getOwnerLanes(asIsSteps ?? [], taskOwnerKey)
  const assignmentKey = asIsLanes.size ? taskOwnerKey : ownerKey
  const ownerLanes = getOwnerLanes(steps, assignmentKey)
  const knownLanes = new Map(steps.filter((step) => clean(step.bpmnLane))
    .map((step) => [key(step.bpmnLane), step.bpmnLane.trim()]))
  const proposals = new Map()
  for (const step of steps) {
    if (clean(step.bpmnLane)) continue
    const owner = ownerKey(step)
    const assignment = assignmentKey(step)
    const current = ownerLanes.get(assignment)
    const previous = asIsLanes.get(assignment)
    const saved = current ?? previous
    const lane = saved?.values().next().value ?? knownLanes.get(owner) ?? clean(step.owner)
    let reason = ''
    if (!owner) reason = 'Brak wykonawcy. Wskaż tor tego kroku.'
    else if (external.has(owner)) reason = 'Wykonawca ma osobny basen. Sprawdź, do kogo należy ten krok.'
    else if (saved?.size > 1) reason = current
      ? 'Ten wykonawca ma kilka zapisanych torów. Wybierz właściwy.'
      : 'Ten wykonawca ma kilka torów w AS-IS. Wybierz właściwy.'
    else if (!saved?.size && /[;/+]|\s(?:i|lub|oraz)\s/u.test(owner)) reason = 'Sprawdź, czy opis wykonawcy oznacza jedną rolę, i zapisz właściwy tor.'
    else if (lane.length > 80) reason = 'Nazwa wykonawcy przekracza 80 znaków. Wpisz krótszą nazwę toru.'
    if (!reason) knownLanes.set(key(lane), lane)
    proposals.set(step.id, reason ? { reason } : { lane, ...(!current && previous && { fromAsIs: true }) })
  }
  return proposals
}

export function applyRoleLanes(steps, externalSteps, asIsSteps) {
  const proposals = proposeRoleLanes(steps, externalSteps, asIsSteps)
  if (!proposals.size) return steps
  if ([...proposals.values()].some((item) => item.reason)) throw new Error('Najpierw rozstrzygnij kroki bez propozycji toru.')
  return steps.map((step) => proposals.has(step.id) ? { ...step, bpmnLane: proposals.get(step.id).lane } : step)
}
