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

function reviewKey(processId) {
  return `${keyFor(processId)}:review`
}

export function loadWorkshopReview(storage, processId, transcript) {
  const value = storage.getItem(reviewKey(processId))
  if (value === null) return { review: null, stale: false }
  let data
  try { data = JSON.parse(value) } catch { throw new Error('Nie można odczytać zapisanej propozycji.') }
  if (!data || data.version !== 1 || typeof data.sourceTranscript !== 'string' || !data.sourceTranscript.trim() || data.sourceTranscript.length > MAX_TRANSCRIPT_LENGTH || validateWorkshopProposal(data.review, data.sourceTranscript).length) {
    throw new Error('Nieprawidłowy zapis propozycji. Dane nie zostały nadpisane.')
  }
  return data.sourceTranscript === transcript
    ? { review: data.review, stale: false }
    : { review: null, stale: true }
}

export function saveWorkshopReview(storage, processId, transcript, review, { replaceStale = false } = {}) {
  const key = reviewKey(processId)
  if (typeof transcript !== 'string' || transcript.length > MAX_TRANSCRIPT_LENGTH || validateWorkshopProposal(review, transcript).length) throw new Error('Nieprawidłowa propozycja.')
  const current = loadWorkshopReview(storage, processId, transcript)
  if (current.stale && !replaceStale) throw new Error('Istnieje propozycja dla innej wersji transkrypcji.')
  storage.setItem(key, JSON.stringify({ version: 1, sourceTranscript: transcript, review }))
}

export function appendWorkshopSteps(existingSteps, names, createId) {
  if (!Array.isArray(existingSteps) || !Array.isArray(names) || typeof createId !== 'function') throw new TypeError('Nieprawidłowe dane kroków.')
  const normalize = (value) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl')
  const seen = new Set(existingSteps.map((step) => typeof step?.name === 'string' ? normalize(step.name) : '').filter(Boolean))
  const added = []
  const skipped = []
  for (const name of names) {
    if (typeof name !== 'string' || !name.trim()) throw new TypeError('Nazwa kroku nie może być pusta.')
    const cleaned = name.trim()
    const normalized = normalize(cleaned)
    if (seen.has(normalized)) { skipped.push(cleaned); continue }
    const id = createId()
    if (typeof id !== 'string' || !id.trim() || existingSteps.some((step) => step?.id === id) || added.some((step) => step.id === id)) throw new Error('Nie udało się utworzyć identyfikatora kroku.')
    added.push({ id, name: cleaned, description: '', owner: '', system: '', result: '' })
    seen.add(normalized)
  }
  return { steps: [...existingSteps, ...added], added, skipped }
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
