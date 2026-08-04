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
