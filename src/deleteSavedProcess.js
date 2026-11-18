import { CURRENT_PROCESS_ID_KEY, isValidProcessId } from './processIdentity'
import { getWorkshopStorageKeys } from './workshop'

const LIBRARY_KEY = 'architekt-procesow:processes'

// The user explicitly selects an inactive saved process. No other keys are changed.
export function deleteSavedProcess(storage, id, expectedProcesses) {
  if (!isValidProcessId(id) || !Array.isArray(expectedProcesses)) throw new Error('Nieprawidłowy proces lub biblioteka.')
  const current = storage.getItem(CURRENT_PROCESS_ID_KEY)
  if (current !== null && !isValidProcessId(current)) throw new Error('Nie można potwierdzić aktywnego procesu. Usuwanie zostało zatrzymane.')
  if (current?.toLowerCase() === id.toLowerCase()) throw new Error('To obecnie otwarty proces. Rozpocznij lub otwórz inny proces przed usunięciem.')
  const libraryRaw = storage.getItem(LIBRARY_KEY)
  let library
  try { library = JSON.parse(libraryRaw) } catch { throw new Error('Nie można odczytać biblioteki. Usuwanie zostało zatrzymane.') }
  if (!Array.isArray(library) || JSON.stringify(library) !== JSON.stringify(expectedProcesses)) throw new Error('Biblioteka zmieniła się lub jest nieczytelna. Odśwież stronę przed usunięciem.')
  const normalizedId = id.toLowerCase()
  if (library.filter((item) => isValidProcessId(item?.id) && item.id.toLowerCase() === normalizedId).length !== 1) throw new Error('Nie można jednoznacznie ustalić procesu. Nic nie usunięto.')
  const keys = [LIBRARY_KEY, ...getWorkshopStorageKeys(normalizedId)]
  const before = keys.map((key) => [key, storage.getItem(key)])
  const remaining = library.filter((item) => !(isValidProcessId(item?.id) && item.id.toLowerCase() === normalizedId))
  try {
    storage.setItem(LIBRARY_KEY, JSON.stringify(remaining))
    for (const key of keys.slice(1)) storage.removeItem(key)
  } catch {
    let restored = true
    for (const [key, value] of before) {
      try { if (value === null) storage.removeItem(key); else storage.setItem(key, value) } catch { restored = false }
    }
    const error = new Error(restored ? 'Nie udało się usunąć procesu. Poprzednie zapisy zostały przywrócone.' : 'Nie udało się w pełni przywrócić zapisów. Wstrzymaj pracę i sprawdź dane przed dalszą edycją.')
    error.code = restored ? 'DELETE_ROLLED_BACK' : 'DELETE_ROLLBACK_FAILED'
    throw error
  }
  return remaining
}
