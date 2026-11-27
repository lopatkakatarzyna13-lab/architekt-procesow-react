const normalize = (name) => name?.trim().toLocaleLowerCase('pl')
const canFillOwner = (row) => Object.values(row ?? {}).every((value) => !value || value === 'C' || value === 'I')
const ownerName = (step) => typeof step.owner === 'string' ? step.owner.trim() : ''

export function getRaciOwnersByStep(steps) {
  return Object.fromEntries(steps.map((step) => [step.id, ownerName(step)]))
}

export function getChangedRaciOwners(steps, previousOwners) {
  return Object.fromEntries(steps.flatMap((step) => {
    if (!Object.hasOwn(previousOwners, step.id)) return []
    const previous = previousOwners[step.id]
    const current = ownerName(step)
    return normalize(previous) === normalize(current) ? [] : [[step.id, { previous, current }]]
  }))
}

export function getMissingRaciOwners(steps, stakeholders, raci) {
  const known = new Set(stakeholders.map(({ name }) => normalize(name)))
  const missing = []
  for (const step of steps) {
    const owner = normalize(step.owner)
    if (!owner || known.has(owner) || !canFillOwner(raci[step.id])) continue
    known.add(owner)
    missing.push(step.owner.trim())
  }
  return missing
}

export function getRaciOwnerAssignments(steps, stakeholders, raci) {
  const assignments = {}

  for (const step of steps) {
    const owner = normalize(step.owner)
    const row = raci[step.id]
    if (!owner || !canFillOwner(row)) continue

    const matches = stakeholders.filter((item) => normalize(item.name) === owner)
    if (matches.length === 1 && !row?.[matches[0].id]) assignments[step.id] = { [matches[0].id]: 'RA' }
  }

  return assignments
}

export function getRaciValidationErrors(steps, raci) {
  return steps.reduce((validationErrors, step) => {
    const assignments = Object.values(raci[step.id] ?? {})
    const messages = []
    const responsibleCount = assignments.filter(
      (value) => value === 'R' || value === 'RA',
    ).length
    const accountableCount = assignments.filter(
      (value) => value === 'A' || value === 'RA',
    ).length

    if (responsibleCount === 0) {
      messages.push('Krok musi mieć przynajmniej jedną rolę Responsible (R).')
    }
    if (accountableCount === 0) {
      messages.push('Krok musi mieć dokładnie jedną rolę Accountable (A).')
    } else if (accountableCount > 1) {
      messages.push('Krok powinien mieć tylko jedną rolę Accountable (A).')
    }
    if (messages.length > 0) {
      validationErrors[step.id] = messages
    }

    return validationErrors
  }, {})
}
