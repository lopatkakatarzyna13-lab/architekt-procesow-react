import { describe, expect, it } from 'vitest'
import { deleteSavedProcess } from './deleteSavedProcess'

const A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const B = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const libraryKey = 'architekt-procesow:processes'
const workshop = (id) => `architekt-procesow:workshop:${id}`
const records = [{ id: A, name: 'A' }, { id: B, name: 'B' }]
function fixture() {
  const map = new Map([[libraryKey, JSON.stringify(records)], [workshop(A), 'tekst A'], [`${workshop(A)}:review`, 'propozycja A'], [workshop(B), 'tekst B'], ['architekt-procesow:as-is', 'aktywny']])
  return { map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) }
}

describe('delete saved process', () => {
  it('removes only the selected saved process and its workshop', () => {
    const store = fixture()
    expect(deleteSavedProcess(store, A, records)).toEqual([records[1]])
    expect(store.getItem(workshop(A))).toBeNull()
    expect(store.getItem(`${workshop(A)}:review`)).toBeNull()
    expect(store.getItem(workshop(B))).toBe('tekst B')
    expect(store.getItem('architekt-procesow:as-is')).toBe('aktywny')
    expect(JSON.parse(store.getItem(libraryKey))).toEqual([records[1]])
  })
  it('refuses an active process, a changed library and duplicate IDs', () => {
    const store = fixture()
    store.setItem('architekt-procesow:current-process-id', A)
    expect(() => deleteSavedProcess(store, A, records)).toThrow(/otwarty proces/)
    store.removeItem('architekt-procesow:current-process-id')
    expect(() => deleteSavedProcess(store, A, [records[0]])).toThrow(/zmieniła się/)
    const duplicate = [...records, { id: A.toUpperCase() }]
    store.setItem(libraryKey, JSON.stringify(duplicate))
    expect(() => deleteSavedProcess(store, A, duplicate)).toThrow(/jednoznacznie/)
    expect(store.getItem(workshop(A))).toBe('tekst A')
  })
  it('restores previous data when deletion fails partway', () => {
    const store = fixture()
    const originalRemove = store.removeItem
    let failed = false
    store.removeItem = (key) => { if (key.endsWith(':review') && !failed) { failed = true; throw Error('fixture') } originalRemove(key) }
    expect(() => deleteSavedProcess(store, A, records)).toThrow(/przywrócone/)
    expect(JSON.parse(store.getItem(libraryKey))).toEqual(records)
    expect(store.getItem(workshop(A))).toBe('tekst A')
    expect(store.getItem(`${workshop(A)}:review`)).toBe('propozycja A')
  })
  it('reports an uncertain state when restoration fails', () => {
    const store = fixture()
    const remove = store.removeItem
    const set = store.setItem
    store.removeItem = (key) => { if (key.endsWith(':review')) throw Error('fixture'); remove(key) }
    store.setItem = (key, value) => { if (key === workshop(A)) throw Error('fixture'); set(key, value) }
    expect(() => deleteSavedProcess(store, A, records)).toThrow(/Wstrzymaj pracę/)
  })
})
