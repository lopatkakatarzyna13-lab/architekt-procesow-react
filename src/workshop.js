import { isValidProcessId } from './processIdentity.js'

const KEY_PREFIX = 'architekt-procesow:workshop:'
export const MAX_TRANSCRIPT_LENGTH = 100_000

function keyFor(processId) {
  if (!isValidProcessId(processId)) throw new TypeError('Nieprawidłowy identyfikator procesu.')
  return `${KEY_PREFIX}${processId.toLowerCase()}`
}

export function loadWorkshop(storage, processId) {
  const value = storage.getItem(keyFor(processId))
  if (value === null) return { transcript: '', savedAt: null }
  let data
  try { data = JSON.parse(value) } catch { throw new Error('Nie można odczytać zapisu warsztatu.') }
  if (!data || data.version !== 1 || typeof data.transcript !== 'string' || data.transcript.length > MAX_TRANSCRIPT_LENGTH || typeof data.savedAt !== 'string' || !Number.isFinite(Date.parse(data.savedAt))) {
    throw new Error('Nieprawidłowy zapis warsztatu. Dane nie zostały nadpisane.')
  }
  return { transcript: data.transcript, savedAt: data.savedAt }
}

export function saveWorkshop(storage, processId, transcript, date = new Date()) {
  const key = keyFor(processId)
  if (typeof transcript !== 'string' || transcript.length > MAX_TRANSCRIPT_LENGTH) throw new TypeError('Transkrypcja jest nieprawidłowa lub zbyt długa.')
  const savedAt = date.toISOString()
  storage.setItem(key, JSON.stringify({ version: 1, transcript, savedAt }))
  return { transcript, savedAt }
}

// A proposal is never applied to a process automatically. Evidence must be
// an exact quote so a reviewer can find it in the transcript.
export function validateWorkshopProposal(proposal, transcript) {
  const errors = []
  if (typeof transcript !== 'string' || !transcript.trim()) return ['Brakuje transkrypcji.']
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return ['Nieprawidłowy format propozycji.']
  for (const category of ['steps', 'roles', 'decisions', 'questions']) {
    if (!Array.isArray(proposal[category])) { errors.push(`Brakuje listy: ${category}.`); continue }
    proposal[category].forEach((item, index) => {
      if (!item || typeof item.text !== 'string' || !item.text.trim()) { errors.push(`${category}[${index}]: brak treści.`); return }
      if (!['supported', 'assumption', 'question'].includes(item.status)) { errors.push(`${category}[${index}]: nieprawidłowy status.`); return }
      if (item.status === 'supported' && (typeof item.evidence !== 'string' || !item.evidence.trim() || !transcript.includes(item.evidence))) {
        errors.push(`${category}[${index}]: brak dokładnego fragmentu źródłowego.`)
      }
    })
  }
  return errors
}
