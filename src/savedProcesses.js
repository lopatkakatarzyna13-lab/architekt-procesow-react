import { isValidProcessId } from './processIdentity'

const REQUIRED_SECTION_KEYS = ['scope', 'asIs', 'analysis', 'toBe', 'report']
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function validateSectionValue(key, value) {
  if (value === null) {
    return
  }

  if (typeof value !== 'string') {
    throw new TypeError(`Sekcja ${key} musi być stringiem albo null.`)
  }

  if (value.length === 0) {
    return
  }

  let parsedValue

  try {
    parsedValue = JSON.parse(value)
  } catch {
    throw new TypeError(`Sekcja ${key} musi zawierać poprawny JSON.`)
  }

  if (!isPlainObject(parsedValue)) {
    throw new TypeError(`JSON sekcji ${key} musi reprezentować obiekt.`)
  }
}

function validateSnapshot(snapshot) {
  if (!isPlainObject(snapshot) || Object.keys(snapshot).length === 0) {
    throw new TypeError('Snapshot procesu musi być niepustym zwykłym obiektem.')
  }

  if (!isValidProcessId(snapshot.id)) {
    throw new TypeError('Snapshot procesu musi zawierać poprawny UUID.')
  }

  if (typeof snapshot.name !== 'string' || !snapshot.name.trim()) {
    throw new TypeError('Nazwa procesu musi być niepustym stringiem.')
  }

  const savedAtTimestamp =
    typeof snapshot.savedAt === 'string' &&
    ISO_TIMESTAMP_PATTERN.test(snapshot.savedAt)
      ? Date.parse(snapshot.savedAt)
      : Number.NaN

  if (
    !Number.isFinite(savedAtTimestamp) ||
    new Date(savedAtTimestamp).toISOString() !== snapshot.savedAt
  ) {
    throw new TypeError('Data zapisu procesu musi być poprawnym stringiem daty.')
  }

  if (typeof snapshot.lastScreen !== 'string' || !snapshot.lastScreen.trim()) {
    throw new TypeError('Ostatni ekran procesu musi być niepustym stringiem.')
  }

  if (!isPlainObject(snapshot.sections) || Object.keys(snapshot.sections).length === 0) {
    throw new TypeError('Sekcje procesu muszą być niepustym zwykłym obiektem.')
  }

  REQUIRED_SECTION_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(snapshot.sections, key)) {
      throw new TypeError(`Brakuje wymaganej sekcji procesu: ${key}.`)
    }

    validateSectionValue(key, snapshot.sections[key])
  })
}

function findProcessIndexAndValidateUniqueIds(processes, snapshotId) {
  const idCounts = new Map()
  let matchingIndex = -1
  const normalizedSnapshotId = snapshotId.toLowerCase()

  processes.forEach((process, index) => {
    if (process === null || typeof process !== 'object') {
      return
    }

    if (!isValidProcessId(process.id)) {
      return
    }

    const normalizedId = process.id.toLowerCase()
    const nextCount = (idCounts.get(normalizedId) ?? 0) + 1
    idCounts.set(normalizedId, nextCount)

    if (nextCount > 1) {
      throw new Error(
        `Biblioteka zawiera powielony identyfikator procesu: ${normalizedId}.`,
      )
    }

    if (normalizedId === normalizedSnapshotId) {
      matchingIndex = index
    }
  })

  return matchingIndex
}

export function upsertSavedProcess(processes, snapshot) {
  if (!Array.isArray(processes)) {
    throw new TypeError('Biblioteka procesów musi być tablicą.')
  }

  validateSnapshot(snapshot)

  const matchingIndex = findProcessIndexAndValidateUniqueIds(
    processes,
    snapshot.id,
  )
  const nextSnapshot = {
    ...snapshot,
    sections: { ...snapshot.sections },
  }

  if (matchingIndex === -1) {
    return [...processes, nextSnapshot]
  }

  return processes.map((process, index) =>
    index === matchingIndex ? nextSnapshot : process,
  )
}
