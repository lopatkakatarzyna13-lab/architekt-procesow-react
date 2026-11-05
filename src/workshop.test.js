import { describe, expect, it } from 'vitest'
import { loadWorkshop, MAX_TRANSCRIPT_LENGTH, saveWorkshop, validateWorkshopProposal } from './workshop'

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
