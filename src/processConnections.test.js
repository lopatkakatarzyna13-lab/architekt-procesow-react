import { describe, expect, it } from 'vitest'
import { addProcessConnection, getProcessConnections, removeProcessConnection, removeStepConnections } from './processConnections.js'

const steps = () => [{ id: 'a', name: 'Weryfikacja' }, { id: 'b', name: 'Uzupełnienie' }, { id: 'c', name: 'Zatwierdzenie' }]
describe('additional process paths', () => {
  it('adds a labelled return without changing the original steps or their order', () => {
    const original = steps()
    const changed = addProcessConnection(original, 'c', 'a', ' Wróć do poprawy ')
    expect(original[2].extraConnections).toBeUndefined()
    expect(changed.map((step) => step.id)).toEqual(['a', 'b', 'c'])
    expect(getProcessConnections(changed)).toEqual([{ sourceId: 'c', targetId: 'a', label: 'Wróć do poprawy', index: 0 }])
    expect(getProcessConnections(removeProcessConnection(changed, 'c', 0))).toEqual([])
  })
  it('rejects invalid, blank, too long and repeated connections', () => {
    const source = steps()
    expect(() => addProcessConnection(source, 'a', 'a', 'Powrót')).toThrow()
    expect(() => addProcessConnection(source, 'a', 'missing', 'Powrót')).toThrow()
    expect(() => addProcessConnection(source, 'a', 'b', ' ')).toThrow()
    expect(() => addProcessConnection(source, 'a', 'b', 'x'.repeat(121))).toThrow()
    expect(() => addProcessConnection(addProcessConnection(source, 'a', 'b', 'Nie'), 'a', 'b', 'Nie')).toThrow()
  })
  it('removes links to a deleted step and ignores dangling links in older data', () => {
    let input = addProcessConnection(steps(), 'a', 'b', 'Brak danych')
    input = addProcessConnection(input, 'c', 'b', 'Popraw')
    expect(getProcessConnections(removeStepConnections(input, 'b'))).toEqual([])
    expect(getProcessConnections(input.filter((step) => step.id !== 'b'))).toEqual([])
  })
})
