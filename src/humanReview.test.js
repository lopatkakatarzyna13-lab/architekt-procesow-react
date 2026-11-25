import { expect, it } from 'vitest'
import { applyHumanReview, getFormImprovementSuggestions, getHumanReviewAction } from './toBeSuggestions'

const [validation] = getFormImprovementSuggestions({ name: 'Braki w formularzu' })
const source = { ...validation, id: 'v', findingId: 'f', nextStepId: 'next', bpmnLane: 'Portal' }
const next = { id: 'next', name: 'Rejestracja', bpmnLane: 'Kadry' }

it('inserts a human task in the selected main path and keeps the original successor', () => {
  const original = [source, next]
  const result = applyHumanReview(original, 'v', 'add', 'Kadry', { id: 'review' })
  expect(result[0].nextStepId).toBe('review')
  expect(result[1]).toMatchObject({ nextStepId: 'next', bpmnTaskType: 'user', owner: 'Kadry', bpmnLane: 'Kadry', findingId: 'f' })
  expect(source.nextStepId).toBe('next')
  expect(applyHumanReview(result, 'v', 'add', 'Kadry', { id: 'extra' })).toBe(result)
})

it('repairs a standard duplicate in place and keeps documents and linked findings', () => {
  const duplicate = { ...source, id: 'next', nextStepId: 'end', bpmnDocuments: [{name: 'Wniosek'}], additionalFindingIds: ['other'] }
  const steps = [source, duplicate, { id: 'end' }]
  expect(getHumanReviewAction(steps, 0)).toBe('replace')
  const result = applyHumanReview(steps, 'v', 'replace', 'Kadry')
  expect(result[1]).toMatchObject({ id: 'next', nextStepId: 'end', bpmnTaskType: 'user', bpmnRule: '', bpmnException: '',
    additionalFindingIds: ['other'], bpmnDocuments: duplicate.bpmnDocuments })
  expect(getHumanReviewAction([source, { ...duplicate, bpmnRule: 'Moja reguła' }], 0)).toBeNull()
})
