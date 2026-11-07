import { describe, expect, it } from 'vitest'
import { appendWorkshopSteps, deleteWorkshop, loadWorkshop, loadWorkshopReview, MAX_TRANSCRIPT_LENGTH, saveWorkshop, saveWorkshopReview, validateWorkshopProposal } from './workshop'

const A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const B = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const storage = () => {
  const data = new Map()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) }
}

describe('workshop storage', () => {
  it('keeps transcripts separate by process and restores saved text', () => {
    const s = storage()
    saveWorkshop(s, A, 'Rozmowa HR', new Date('2026-11-05T12:00:00.000Z'))
    expect(loadWorkshop(s, A).transcript).toBe('Rozmowa HR')
    expect(loadWorkshop(s, B).transcript).toBe('')
    saveWorkshop(s, B, 'Inny proces')
    expect(loadWorkshop(s, A).transcript).toBe('Rozmowa HR')
  })
  it('rejects invalid identifiers, corrupt data and oversized transcripts', () => {
    const s = storage()
    expect(() => saveWorkshop(s, 'bad', 'tekst')).toThrow()
    expect(() => saveWorkshop(s, A, 'x'.repeat(MAX_TRANSCRIPT_LENGTH + 1))).toThrow()
    s.setItem(`architekt-procesow:workshop:${A}`, '{')
    expect(() => loadWorkshop(s, A)).toThrow()
    expect(s.getItem(`architekt-procesow:workshop:${A}`)).toBe('{')
  })
  it('reports storage failures rather than claiming a save', () => {
    expect(() => saveWorkshop({ setItem: () => { throw new Error('quota') } }, A, 'tekst')).toThrow('quota')
  })
})

describe('proposal validation', () => {
  const transcript = 'HR: Sprawdzam kompletność danych. Brakuje ścieżki eskalacji.'
  const valid = () => ({ steps: [{ text: 'Sprawdź dane', status: 'supported', evidence: 'Sprawdzam kompletność danych.' }], roles: [{ text: 'HR', status: 'supported', evidence: 'HR' }], decisions: [], questions: [{ text: 'Jaka jest ścieżka eskalacji?', status: 'question' }] })
  it('accepts supported items with exact evidence and explicit open questions', () => expect(validateWorkshopProposal(valid(), transcript)).toEqual([]))
  it('rejects invented evidence and missing categories', () => {
    const p = valid(); p.steps[0].evidence = 'Wysyłam dane'; delete p.roles
    expect(validateWorkshopProposal(p, transcript)).toHaveLength(2)
  })
  it('requires a transcript and valid statuses', () => {
    expect(validateWorkshopProposal(valid(), '')).not.toEqual([])
    const p = valid(); p.questions[0].status = 'verified'
    expect(validateWorkshopProposal(p, transcript)).not.toEqual([])
  })
})

describe('review persistence', () => {
  const transcript = 'HR sprawdza dane.'
  const review = () => ({ steps: [{ text: 'Kontrola danych', status: 'supported', evidence: 'HR sprawdza dane.' }], roles: [], decisions: [], questions: [] })
  it('restores a saved review only for its process and exact source transcript', () => {
    const s = storage()
    saveWorkshopReview(s, A, transcript, review())
    expect(loadWorkshopReview(s, A, transcript).review).toEqual(review())
    expect(loadWorkshopReview(s, B, transcript)).toEqual({ review: null, stale: false })
    expect(loadWorkshopReview(s, A, 'HR zmienia dane.')).toEqual({ review: null, stale: true })
  })
  it('requires explicit replacement for a review from an older transcript', () => {
    const s = storage()
    const other = { steps: [], roles: [], decisions: [], questions: [{ text: 'Kto zatwierdza?', status: 'question', evidence: '' }] }
    saveWorkshopReview(s, A, transcript, review())
    expect(() => saveWorkshopReview(s, A, 'Inny tekst', other)).toThrow()
    expect(loadWorkshopReview(s, A, transcript).review).toEqual(review())
    saveWorkshopReview(s, A, 'Inny tekst', other, { replaceStale: true })
    expect(loadWorkshopReview(s, A, 'Inny tekst').review).toEqual(other)
  })
  it('rejects malformed or ungrounded review without overwriting existing data', () => {
    const s = storage()
    saveWorkshopReview(s, A, transcript, review())
    const bad = review(); bad.steps[0].evidence = 'Nie występuje'
    expect(() => saveWorkshopReview(s, A, transcript, bad)).toThrow()
    expect(loadWorkshopReview(s, A, transcript).review).toEqual(review())
    s.setItem(`architekt-procesow:workshop:${A}:review`, '{')
    expect(() => saveWorkshopReview(s, A, transcript, review())).toThrow()
    expect(s.getItem(`architekt-procesow:workshop:${A}:review`)).toBe('{')
  })
  it('preserves data when saving fails', () => {
    const s = storage()
    saveWorkshopReview(s, A, transcript, review())
    const failing = { ...s, setItem: () => { throw new Error('quota') } }
    expect(() => saveWorkshopReview(failing, A, transcript, review())).toThrow('quota')
    expect(loadWorkshopReview(s, A, transcript).review).toEqual(review())
  })
})

describe('transfer of selected steps', () => {
  it('appends distinct names in selection order and leaves roles unassigned', () => {
    const old = [{ id: 'old', name: 'Weryfikacja danych', owner: 'HR' }]
    let id = 0
    const result = appendWorkshopSteps(old, ['Weryfikacja  danych', ' Przygotowanie dokumentów ', 'przygotowanie dokumentów', 'Przekazanie danych'], () => `new-${++id}`)
    expect(result.added.map((step) => step.name)).toEqual(['Przygotowanie dokumentów', 'Przekazanie danych'])
    expect(result.skipped).toEqual(['Weryfikacja  danych', 'przygotowanie dokumentów'])
    expect(result.steps[0]).toEqual(old[0])
    expect(result.added[0].owner).toBe('')
    expect(old).toHaveLength(1)
  })
  it('rejects empty names and ID collisions without changing existing steps', () => {
    const old = [{ id: 'same', name: 'Krok' }]
    expect(() => appendWorkshopSteps(old, [' '], () => 'new')).toThrow()
    expect(() => appendWorkshopSteps(old, ['Inny'], () => 'same')).toThrow()
    expect(old).toEqual([{ id: 'same', name: 'Krok' }])
  })
})

describe('security: workshop retention and migration', () => {
  const transcript = 'HR sprawdza dokumenty.'
  const review = { steps: [{ text: 'Kontrola', status: 'supported', evidence: 'HR sprawdza dokumenty.' }], roles: [], decisions: [], questions: [] }
  const key = `architekt-procesow:workshop:${A}`
  const reviewKey = `${key}:review`

  it('stores review version 2 without a second full transcript', () => {
    const s = storage()
    saveWorkshop(s, A, transcript)
    saveWorkshopReview(s, A, transcript, review)
    const value = JSON.parse(s.getItem(reviewKey))
    expect(value.version).toBe(2)
    expect(typeof value.sourceMarker).toBe('string')
    expect(value).not.toHaveProperty('sourceTranscript')
    expect(s.getItem(reviewKey)).not.toContain(transcript)
    expect(loadWorkshopReview(s, A, transcript).review).toEqual(review)
    expect(loadWorkshopReview(s, A, 'Inna transkrypcja').stale).toBe(true)
  })

  it('migrates legacy review on read without losing reviewed steps', () => {
    const s = storage()
    saveWorkshop(s, A, transcript)
    s.setItem(reviewKey, JSON.stringify({ version: 1, sourceTranscript: transcript, review }))
    expect(loadWorkshopReview(s, A, transcript).review).toEqual(review)
    const migrated = JSON.parse(s.getItem(reviewKey))
    expect(migrated.version).toBe(2)
    expect(migrated.sourceTranscript).toBeUndefined()
    expect(migrated.review).toEqual(review)
  })

  it('does not overwrite invalid legacy data during attempted migration', () => {
    const s = storage()
    const malformed = JSON.stringify({ version: 1, sourceTranscript: transcript, review: { ...review, steps: [{ text: 'Wymyślone', status: 'supported', evidence: 'brak dowodu' }] } })
    s.setItem(reviewKey, malformed)
    expect(() => loadWorkshopReview(s, A, transcript)).toThrow()
    expect(s.getItem(reviewKey)).toBe(malformed)
  })

  it('deletes only the selected workshop and review while retaining saved library', () => {
    const s = storage()
    saveWorkshop(s, A, transcript)
    saveWorkshopReview(s, A, transcript, review)
    saveWorkshop(s, B, 'Inny proces')
    s.setItem('architekt-procesow:processes', JSON.stringify([{ id: A, name: 'Biblioteka' }]))
    s.setItem('architekt-procesow:as-is', '{"steps":[{"name":"Kontrola"}]}')
    deleteWorkshop(s, A)
    expect(s.getItem(key)).toBeNull()
    expect(s.getItem(reviewKey)).toBeNull()
    expect(loadWorkshop(s, B).transcript).toBe('Inny proces')
    expect(JSON.parse(s.getItem('architekt-procesow:processes'))).toHaveLength(1)
    expect(s.getItem('architekt-procesow:as-is')).toContain('Kontrola')
  })

  it('restores existing workshop and review when deletion partially fails', () => {
    const s = storage()
    saveWorkshop(s, A, transcript)
    saveWorkshopReview(s, A, transcript, review)
    const failing = {
      ...s,
      removeItem(k) {
        if (k === reviewKey) throw new Error('blocked')
        return s.removeItem(k)
      },
    }
    expect(() => deleteWorkshop(failing, A)).toThrow(/przywró/)
    expect(loadWorkshop(s, A).transcript).toBe(transcript)
    expect(loadWorkshopReview(s, A, transcript).review).toEqual(review)
  })

  it('rejects invalid process ID without touching storage', () => {
    const s = storage()
    saveWorkshop(s, A, transcript)
    expect(() => deleteWorkshop(s, 'invalid')).toThrow()
    expect(loadWorkshop(s, A).transcript).toBe(transcript)
  })
})
