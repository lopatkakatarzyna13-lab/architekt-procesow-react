import { validateWorkshopProposal } from '../supabase/functions/_shared/validateWorkshopProposal.js'
export { validateWorkshopProposal }
import { isValidProcessId } from './processIdentity.js'

const KEY_PREFIX = 'architekt-procesow:workshop:'
export const MAX_TRANSCRIPT_LENGTH = 100_000
export const MAX_WORKSHOP_ANSWER_LENGTH = 2_000
export const MAX_WORKSHOP_ASSIGNEE_LENGTH = 120

function isWorkshopDueDate(value) {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateWorkshopReview(review, transcript) {
  const errors = validateWorkshopProposal(review, transcript)
  if (errors.length) return errors

  for (const question of review.questions) {
    if (question.answer !== undefined &&
      (typeof question.answer !== 'string' || question.answer.length > MAX_WORKSHOP_ANSWER_LENGTH)) {
      errors.push('Nieprawidłowa odpowiedź na pytanie warsztatowe.')
    }
    if (question.answerConfirmed !== undefined &&
      (typeof question.answerConfirmed !== 'boolean' ||
        (question.answerConfirmed && (typeof question.answer !== 'string' || !question.answer.trim())))) {
      errors.push('Potwierdzenie wymaga treści odpowiedzi.')
    }
    if (question.assignee !== undefined &&
      (typeof question.assignee !== 'string' || question.assignee.length > MAX_WORKSHOP_ASSIGNEE_LENGTH)) {
      errors.push('Nieprawidłowa osoba lub zespół odpowiedzialny za odpowiedź.')
    }
    if (question.dueDate !== undefined && question.dueDate !== '' && !isWorkshopDueDate(question.dueDate)) {
      errors.push('Wpisz poprawny termin odpowiedzi.')
    }
  }
  return errors
}

export function formatOpenWorkshopQuestions(questions, processName) {
  const items = questions.map(({ text, assignee, dueDate }, index) => [
    `${index + 1}. ${text.trim().replace(/\s+/g, ' ')}`,
    `   Osoba lub zespół: ${assignee?.trim() || 'do ustalenia'}`,
    `   Termin: ${dueDate ? dueDate.split('-').reverse().join('.') : 'do ustalenia'}`,
  ].join('\n'))
  const heading = processName?.trim() ? `Otwarte pytania — ${processName.trim()}` : 'Otwarte pytania'
  return `${[heading, ...items].join('\n\n')}\n`
}

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

// A version marker for stale-draft detection, NOT a cryptographic signature.
// The complete source transcript is stored only in the workshop record.
function transcriptMarker(transcript) {
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < transcript.length; index += 1) {
    hash ^= BigInt(transcript.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return `${transcript.length}:${hash.toString(16).padStart(16, '0')}`
}

export function loadWorkshopReview(storage, processId, transcript) {
  const key = reviewKey(processId)
  const value = storage.getItem(key)
  if (value === null) return { review: null, stale: false }
  let data
  try { data = JSON.parse(value) } catch { throw new Error('Nie można odczytać zapisanej propozycji.') }

  if (data?.version === 1) {
    // Legacy records contain an extra full copy of the transcript.
    if (typeof data.sourceTranscript !== 'string' || !data.sourceTranscript.trim() ||
      data.sourceTranscript.length > MAX_TRANSCRIPT_LENGTH ||
      validateWorkshopReview(data.review, data.sourceTranscript).length) {
      throw new Error('Nieprawidłowy zapis propozycji. Dane nie zostały nadpisane.')
    }
    const stale = data.sourceTranscript !== transcript
    // The legacy review was verified against its own original transcript.
    // Keep the same provenance marker even if the current transcript changed.
    storage.setItem(key, JSON.stringify({
      version: 2,
      sourceMarker: transcriptMarker(data.sourceTranscript),
      review: data.review,
    }))
    return stale ? { review: null, stale: true } : { review: data.review, stale: false }
  }

  if (data?.version !== 2 || typeof data.sourceMarker !== 'string' ||
    !/^\d+:[0-9a-f]{16}$/.test(data.sourceMarker) || !data.review ||
    typeof data.review !== 'object') {
    throw new Error('Nieprawidłowy zapis propozycji. Dane nie zostały nadpisane.')
  }
  if (data.sourceMarker !== transcriptMarker(transcript)) return { review: null, stale: true }
  if (validateWorkshopReview(data.review, transcript).length) {
    throw new Error('Nieprawidłowy zapis propozycji. Dane nie zostały nadpisane.')
  }
  return { review: data.review, stale: false }
}

export function saveWorkshopReview(storage, processId, transcript, review, { replaceStale = false } = {}) {
  const key = reviewKey(processId)
  if (typeof transcript !== 'string' || transcript.length > MAX_TRANSCRIPT_LENGTH || validateWorkshopReview(review, transcript).length) throw new Error('Nieprawidłowa propozycja.')
  const current = loadWorkshopReview(storage, processId, transcript)
  if (current.stale && !replaceStale) throw new Error('Istnieje propozycja dla innej wersji transkrypcji.')
  storage.setItem(key, JSON.stringify({ version: 2, sourceMarker: transcriptMarker(transcript), review }))
}

// Delete only the selected process's workshop and its review. Never touch
// section snapshots or the process library. Roll back partial failures.
export function deleteWorkshop(storage, processId) {
  const keys = [keyFor(processId), reviewKey(processId)]
  const backup = keys.map((key) => ({ key, value: storage.getItem(key) }))
  try {
    for (const { key } of backup) storage.removeItem(key)
  } catch {
    let restored = true
    for (const { key, value } of backup) {
      try {
        if (value === null) storage.removeItem(key)
        else storage.setItem(key, value)
      } catch { restored = false }
    }
    const error = new Error(restored
      ? 'Nie udało się usunąć warsztatu. Poprzednie dane zostały przywrócone.'
      : 'Nie udało się w pełni przywrócić warsztatu. Nie kontynuuj edycji.')
    error.code = restored ? 'DELETE_ROLLED_BACK' : 'DELETE_ROLLBACK_FAILED'
    throw error
  }
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
