import { getBpmnMessages, getExternalPools } from './bpmnMessages.js'

const clean = (value) => typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
const key = (value) => clean(value).toLocaleLowerCase('pl')

export function proposeRoleLanes(steps, externalSteps = []) {
  const external = new Set(getExternalPools(getBpmnMessages(steps)).map(([, name]) => key(name)))
  for (const action of externalSteps) external.add(key(action.participant))
  const knownLanes = new Map()
  const ownerLanes = new Map()
  for (const step of steps) {
    const lane = typeof step.bpmnLane === 'string' ? step.bpmnLane.trim() : ''
    if (!lane) continue
    knownLanes.set(key(lane), lane)
    const owner = key(step.owner)
    if (!ownerLanes.has(owner)) ownerLanes.set(owner, new Set())
    ownerLanes.get(owner).add(lane)
  }
  const proposals = new Map()
  for (const step of steps) {
    if (clean(step.bpmnLane)) continue
    const owner = key(step.owner)
    const saved = ownerLanes.get(owner)
    const lane = saved?.values().next().value ?? knownLanes.get(owner) ?? clean(step.owner)
    let reason = ''
    if (!owner) reason = 'Brak wykonawcy. Wskaż tor tego kroku.'
    else if (external.has(owner)) reason = 'Wykonawca ma osobny basen. Sprawdź, do kogo należy ten krok.'
    else if (saved?.size > 1) reason = 'Ten wykonawca ma kilka zapisanych torów. Wybierz właściwy.'
    else if (!saved?.size && /[;/+]|\s(?:i|lub|oraz)\s/u.test(owner)) reason = 'Sprawdź, czy opis wykonawcy oznacza jedną rolę, i zapisz właściwy tor.'
    else if (lane.length > 80) reason = 'Nazwa wykonawcy przekracza 80 znaków. Wpisz krótszą nazwę toru.'
    if (!reason) knownLanes.set(key(lane), lane)
    proposals.set(step.id, reason ? { reason } : { lane })
  }
  return proposals
}

export function applyRoleLanes(steps, externalSteps) {
  const proposals = proposeRoleLanes(steps, externalSteps)
  if (!proposals.size) return steps
  if ([...proposals.values()].some((item) => item.reason)) throw new Error('Najpierw rozstrzygnij kroki bez propozycji toru.')
  return steps.map((step) => proposals.has(step.id) ? { ...step, bpmnLane: proposals.get(step.id).lane } : step)
}
