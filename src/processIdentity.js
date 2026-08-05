export const CURRENT_PROCESS_ID_KEY = 'architekt-procesow:current-process-id'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidProcessId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function loadCurrentProcessId(storage) {
  const processId = storage.getItem(CURRENT_PROCESS_ID_KEY)

  return isValidProcessId(processId) ? processId : null
}

export function createProcessId(cryptoApi) {
  const processId = cryptoApi.randomUUID()

  if (!isValidProcessId(processId)) {
    throw new Error('Wygenerowany identyfikator procesu nie jest poprawnym UUID-em.')
  }

  return processId
}

export function saveCurrentProcessId(storage, id) {
  if (!isValidProcessId(id)) {
    throw new TypeError('Identyfikator procesu musi być poprawnym UUID-em.')
  }

  const currentProcessId = storage.getItem(CURRENT_PROCESS_ID_KEY)

  if (currentProcessId === null) {
    storage.setItem(CURRENT_PROCESS_ID_KEY, id)
    return
  }

  if (!isValidProcessId(currentProcessId)) {
    throw new Error(
      'Zapisany identyfikator procesu jest nieprawidłowy i nie może zostać automatycznie nadpisany.',
    )
  }

  if (currentProcessId.toLowerCase() === id.toLowerCase()) {
    return
  }

  throw new Error(
    'Konflikt identyfikatora procesu: nie można zastąpić istniejącego UUID-u innym UUID-em.',
  )
}

export function activateProcessId(storage, processId) {
  if (!isValidProcessId(processId)) {
    throw new TypeError('Identyfikator aktywowanego procesu musi być poprawnym UUID-em.')
  }

  const currentProcessId = storage.getItem(CURRENT_PROCESS_ID_KEY)

  if (currentProcessId === null) {
    storage.setItem(CURRENT_PROCESS_ID_KEY, processId)
    return
  }

  if (!isValidProcessId(currentProcessId)) {
    throw new Error(
      'Zapisany identyfikator aktywnego procesu jest nieprawidłowy i nie może zostać automatycznie nadpisany.',
    )
  }

  if (currentProcessId.toLowerCase() === processId.toLowerCase()) {
    return
  }

  storage.setItem(CURRENT_PROCESS_ID_KEY, processId)
}

export function removeCurrentProcessId(storage) {
  storage.removeItem(CURRENT_PROCESS_ID_KEY)
}
