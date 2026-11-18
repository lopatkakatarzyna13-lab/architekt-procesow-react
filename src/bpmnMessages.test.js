import { describe, expect, it } from 'vitest'
import { addBpmnMessage, getBpmnMessages, removeBpmnMessage } from './bpmnMessages'

const initial = () => [{ id: 'a', name: 'Wyślij dane' }, { id: 'b', name: 'Odbierz dokumenty' }]
describe('BPMN collaboration messages', () => {
  it('adds explicit outbound and inbound messages without mutating steps', () => {
    const old = initial()
    let result = addBpmnMessage(old, 'a', 'Firma', 'Biuro', 'outgoing', 'Dane')
    result = addBpmnMessage(result, 'b', 'Firma', 'biuro', 'incoming', 'Dokumenty')
    expect(old[0].bpmnMessages).toBeUndefined()
    expect(getBpmnMessages(result).map((m) => m.direction)).toEqual(['outgoing', 'incoming'])
    expect(getBpmnMessages(removeBpmnMessage(result, 'a', 0))).toHaveLength(1)
  })
  it('rejects unconfirmed, duplicated, and same-participant messages', () => {
    const steps = initial()
    expect(() => addBpmnMessage(steps, 'a', 'Firma', 'firma', 'outgoing', 'Dane')).toThrow()
    expect(() => addBpmnMessage(steps, 'a', 'Firma', 'Biuro', '', 'Dane')).toThrow()
    const result = addBpmnMessage(steps, 'a', 'Firma', 'Biuro', 'outgoing', 'Dane')
    expect(() => addBpmnMessage(result, 'a', 'Firma', 'Biuro', 'outgoing', 'Dane')).toThrow()
    expect(() => addBpmnMessage(result, 'b', 'Inna firma', 'Biuro', 'incoming', 'Dokument')).toThrow()
    const withBank = addBpmnMessage(result, 'b', 'Firma', 'Bank', 'incoming', 'Dokument')
    expect(getBpmnMessages(withBank).map(({ external }) => external)).toEqual(['Biuro', 'Bank'])
  })
})
