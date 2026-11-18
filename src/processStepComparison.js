const comparableFields = [
  ['name', 'Nazwa'],
  ['owner', 'Odpowiedzialność'],
  ['system', 'System'],
]

const fieldValue = (value) => typeof value === 'string' ? value.trim() : ''

export function compareProcessSteps(asIsSteps, toBeSteps) {
  const sourceById = new Map(asIsSteps.map((step) => [step.id, step]))
  const matchedIds = new Set()
  const changed = []
  const unmatchedToBe = []

  for (const step of toBeSteps) {
    const sourceId = step.sourceAsIsStepId || /^as-is-copy-(.+)-\d+$/.exec(step.id)?.[1]
    const source = sourceById.get(sourceId)
    if (!source) {
      unmatchedToBe.push(step)
      continue
    }

    matchedIds.add(sourceId)
    const differences = comparableFields.flatMap(([field, label]) => {
      const before = fieldValue(source[field])
      const after = fieldValue(step[field])
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
