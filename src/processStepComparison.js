import { bpmnDocumentDirections, bpmnStepFields, bpmnTaskTypes, describeBpmnDocument, getBpmnDocuments } from './bpmnStepDetails.js'

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

function sourceStepId(step) {
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

export function compareProcessSteps(asIsSteps, toBeSteps) {
  const sourceById = new Map(asIsSteps.map((step) => [step.id, step]))
  const matchedIds = new Set()
  const changed = []
  const unmatchedToBe = []

  for (const step of toBeSteps) {
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
