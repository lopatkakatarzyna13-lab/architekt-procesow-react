import { describe, expect, it } from 'vitest'
import { loadWorkshop, loadWorkshopReview, MAX_TRANSCRIPT_LENGTH, saveWorkshop, saveWorkshopReview, validateWorkshopProposal } from './workshop'

const A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const B = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const storage = () => {
  const data = new Map()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }
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
