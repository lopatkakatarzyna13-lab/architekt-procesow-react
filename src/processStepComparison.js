import { bpmnDocumentDirections, bpmnStepFields, bpmnTaskTypes, describeBpmnDocument, getBpmnDocuments } from './bpmnStepDetails.js'
import { getBpmnMessages } from './bpmnMessages.js'
import { getNextProcessStepId } from './processConnections.js'

const comparableFields = [
  ['name', 'Nazwa'],
  ['owner', 'Odpowiedzialność'],
  ['system', 'System'],
  ['bpmnTaskType', 'Typ zadania BPMN'],
  ...bpmnStepFields,
  ['bpmnDocuments', 'Dokumenty'],
]

function fieldValue(step, field) {
  if (field === 'bpmnTaskType') return bpmnTaskTypes[step[field]]?.label ?? ''
  if (field === 'bpmnDocuments') return getBpmnDocuments(step)
    .map((document) => `${bpmnDocumentDirections[document.direction]}: ${describeBpmnDocument(document)}`).join('; ')
  return typeof step[field] === 'string' ? step[field].trim() : ''
}

export function sourceStepId(step) {
  return step.sourceAsIsStepId || /^as-is-copy-(.+)-\d+$/.exec(step.id)?.[1]
}

export function getMissingToBeSteps(asIsSteps, toBeSteps) {
  const normalizeName = (name) => typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl') : ''
  const asIsIds = new Set(asIsSteps.map(({ id }) => id))
  const usedIds = new Set()
  const nameMatches = new Map()
  for (const step of toBeSteps) {
    const id = sourceStepId(step)
    if (asIsIds.has(id)) {
      usedIds.add(id)
    } else {
      const name = normalizeName(step.name)
      nameMatches.set(name, (nameMatches.get(name) ?? 0) + 1)
    }
  }
  return asIsSteps.filter((step) => {
    const name = normalizeName(step.name)
    if (!name || usedIds.has(step.id)) return false
    const matches = nameMatches.get(name) ?? 0
    if (!matches) return true
    nameMatches.set(name, matches - 1)
    return false
  })
}

function compareMapValues(before, after) {
  const key = (entries) => JSON.stringify(entries.map(([id]) => id).sort())
  return key(before) === key(after) ? null : {
    before: before.map(([, text]) => text).join(' · '),
    after: after.map(([, text]) => text).join(' · '),
  }
}

function mapFields(step, index, steps, target, actions) {
  const route = (id, label, toDecision = false) => {
    const [key, name] = target(id)
    return [JSON.stringify([key, label, toDecision]), `${label} → ${toDecision ? 'decyzja po kroku ' : ''}${name}`]
  }
  const branches = Array.isArray(step.extraConnections) ? step.extraConnections : []
  const decision = branches.length ? step.bpmnDecision : undefined
  const question = decision?.question?.trim()
  const main = decision?.mainLabel?.trim()
  const messages = getBpmnMessages([step]).filter(({ primary, external, direction, label }) =>
    [primary, external, label].every((value) => typeof value === 'string' && value.trim())
    && ['outgoing', 'incoming'].includes(direction)).map(({ primary, external, direction, label, externalStepId }) => {
    const action = externalStepId ? actions.get(externalStepId) ?? externalStepId : ''
    const endpoint = action ? `${external} / ${action}` : external
    const endpoints = direction === 'outgoing' ? `${primary} → ${endpoint}` : `${endpoint} → ${primary}`
    return [JSON.stringify([primary, external, direction, label, action]), `${endpoints} — ${label}`]
  })
  return {
    bpmnDecisionQuestion: question ? [[question, question]] : [],
    bpmnDecisionMain: main ? [route(getNextProcessStepId(steps, index), main, Boolean(step.nextIsDecision))] : [],
    bpmnDecisionBranches: branches.filter((branch) => branch?.label?.trim())
      .map(({ targetId, label }) => route(targetId, label.trim())),
    bpmnMessages: messages,
  }
}

const mapFieldLabels = [
  ['bpmnDecisionQuestion', 'Pytanie decyzji BPMN'],
  ['bpmnDecisionMain', 'Ścieżka podstawowa decyzji'],
  ['bpmnDecisionBranches', 'Dodatkowe ścieżki decyzji'],
  ['bpmnMessages', 'Wiadomości BPMN'],
]

export function compareProcessSteps(asIsSteps, toBeSteps, { asIsExternalSteps = [], toBeExternalSteps = [] } = {}) {
  const sourceById = new Map(asIsSteps.map((step) => [step.id, step]))
  const sourceIndexes = new Map(asIsSteps.map(({ id }, index) => [id, index]))
  const targetById = new Map(toBeSteps.map((step) => [step.id, step]))
  const sourceCounts = new Map()
  for (const step of toBeSteps) {
    const id = sourceStepId(step)
    sourceCounts.set(id, (sourceCounts.get(id) ?? 0) + 1)
  }
  const describeTarget = (id, byId, toBe = false) => {
    if (id === undefined) return ['end', 'Koniec procesu']
    const step = byId.get(id)
    const source = toBe && step ? sourceStepId(step) : id
    const linked = sourceById.has(source) && (!toBe || sourceCounts.get(source) === 1)
    return [linked ? `as-is:${source}` : `unlinked:${id}`, step?.name ?? 'Nieznany krok']
  }
  const sourceActions = new Map(asIsExternalSteps.map(({ id, name }) => [id, name]))
  const targetActions = new Map(toBeExternalSteps.map(({ id, name }) => [id, name]))
  const matchedIds = new Set()
  const changed = []
  const unmatchedToBe = []

  for (const [index, step] of toBeSteps.entries()) {
    const sourceId = sourceStepId(step)
    const source = sourceById.get(sourceId)
    if (!source) {
      unmatchedToBe.push(step)
      continue
    }

    matchedIds.add(sourceId)
    const differences = comparableFields.flatMap(([field, label]) => {
      const before = fieldValue(source, field)
      const after = fieldValue(step, field)
      return before === after ? [] : [{ field, label, before, after }]
    })
    const beforeMap = mapFields(source, sourceIndexes.get(source.id), asIsSteps, (id) => describeTarget(id, sourceById), sourceActions)
    const afterMap = mapFields(step, index, toBeSteps, (id) => describeTarget(id, targetById, true), targetActions)
    for (const [field, label] of mapFieldLabels) {
      const change = compareMapValues(beforeMap[field], afterMap[field])
      if (change) differences.push({ field, label, ...change })
    }
    if (differences.length) changed.push({ id: step.id, name: step.name, differences })
  }

  return { changed, unmatchedToBe, unmatchedAsIs: asIsSteps.filter(({ id }) => !matchedIds.has(id)) }
}

export function withDetectedStepChanges(steps, comparison) {
  if (!comparison?.changed.length) return steps
  const changedIds = new Set(comparison.changed.map(({ id }) => id))
  return steps.map((step) => step.stepType === 'Bez zmian' && changedIds.has(step.id)
    ? { ...step, stepType: 'Zmieniony' }
    : step)
}
