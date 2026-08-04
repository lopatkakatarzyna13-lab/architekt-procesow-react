import { describe, expect, it } from 'vitest'
import { upsertSavedProcess } from './savedProcesses'

const processId = '123e4567-e89b-42d3-a456-426614174000'
const otherProcessId = '7d444840-9dc0-4f5c-b245-5b7b4de43f01'
const thirdProcessId = 'a8098c1a-f86e-41da-bd1e-5c9bcf65b322'
const savedAt = '2026-08-04T12:00:00.000Z'
const previouslyGeneratedSavedAt = new Date(
  '2025-11-23T08:15:30.456Z',
).toISOString()
const requiredSectionKeys = ['scope', 'asIs', 'analysis', 'toBe', 'report']

function createSections(overrides = {}) {
  return {
    scope: JSON.stringify({ data: { processName: 'Proces testowy' } }),
    asIs: JSON.stringify({ steps: [] }),
    analysis: null,
    toBe: null,
    report: null,
    ...overrides,
  }
}

function createSnapshot(overrides = {}) {
  return {
    id: processId,
    name: 'Proces testowy',
    savedAt,
    lastScreen: 'scope',
    sections: createSections(),
    ...overrides,
  }
}

describe('upsertSavedProcess', () => {
  describe('walidacja processes', () => {
    it.each([
      ['null', null],
      ['obiekt', {}],
      ['string', 'processes'],
      ['undefined', undefined],
    ])('odrzuca %s zamiast tablicy', (_description, processes) => {
      expect(() => upsertSavedProcess(processes, createSnapshot())).toThrow(
        TypeError,
      )
    })
  })

  describe('walidacja snapshotu', () => {
    it('odrzuca brak snapshotu', () => {
      expect(() => upsertSavedProcess([])).toThrow(TypeError)
    })

    it('odrzuca pusty snapshot', () => {
      expect(() => upsertSavedProcess([], {})).toThrow(TypeError)
    })

    it('odrzuca snapshot będący tablicą', () => {
      expect(() => upsertSavedProcess([], [])).toThrow(TypeError)
    })

    it('odrzuca brak UUID', () => {
      const snapshot = createSnapshot()
      delete snapshot.id

      expect(() => upsertSavedProcess([], snapshot)).toThrow(TypeError)
    })

    it('odrzuca błędny UUID', () => {
      expect(() =>
        upsertSavedProcess([], createSnapshot({ id: 'invalid' })),
      ).toThrow(TypeError)
    })

    it.each([
      ['pustą nazwę', ''],
      ['białą nazwę', '   '],
      ['nazwę niebędącą stringiem', 123],
    ])('odrzuca %s', (_description, name) => {
      expect(() => upsertSavedProcess([], createSnapshot({ name }))).toThrow(
        TypeError,
      )
    })

    it('odrzuca brak savedAt', () => {
      const snapshot = createSnapshot()
      delete snapshot.savedAt

      expect(() => upsertSavedProcess([], snapshot)).toThrow(TypeError)
    })

    it.each([
      ['pusty string', ''],
      ['same białe znaki', '   '],
      ['wartość niebędącą stringiem', 123],
      ['string „0”', '0'],
      ['tekst niebędący datą', 'not-a-date'],
      ['nieistniejący 31 lutego', '2026-02-31T12:00:00.000Z'],
      ['29 lutego w roku nieprzestępnym', '2026-02-29T12:00:00.000Z'],
      ['format bez milisekund', '2026-02-28T12:00:00Z'],
      ['datę z przesunięciem strefy', '2026-02-28T13:00:00.000+01:00'],
    ])('odrzuca savedAt: %s', (_description, invalidSavedAt) => {
      expect(() =>
        upsertSavedProcess([], createSnapshot({ savedAt: invalidSavedAt })),
      ).toThrow(TypeError)
    })

    it.each([
      ['29 lutego w roku przestępnym', '2024-02-29T12:00:00.000Z'],
      ['poprawną datę w roku nieprzestępnym', '2026-02-28T12:00:00.000Z'],
      ['wartość utworzoną wcześniej przez toISOString()', previouslyGeneratedSavedAt],
    ])('akceptuje savedAt: %s', (_description, validSavedAt) => {
      const result = upsertSavedProcess(
        [],
        createSnapshot({ savedAt: validSavedAt }),
      )

      expect(result[0].savedAt).toBe(validSavedAt)
    })

    it.each([
      ['brak lastScreen', undefined],
      ['pusty lastScreen', ''],
      ['lastScreen zawierający tylko białe znaki', '   '],
      ['lastScreen niebędący stringiem', 123],
    ])('odrzuca %s', (_description, lastScreen) => {
      expect(() =>
        upsertSavedProcess([], createSnapshot({ lastScreen })),
      ).toThrow(TypeError)
    })

    it.each([
      ['brak sections', undefined],
      ['null zamiast sections', null],
      ['tablicę zamiast sections', []],
    ])('odrzuca %s', (_description, sections) => {
      expect(() =>
        upsertSavedProcess([], createSnapshot({ sections })),
      ).toThrow(TypeError)
    })

    it.each(requiredSectionKeys)('odrzuca brak sekcji %s', (missingKey) => {
      const sections = createSections()
      delete sections[missingKey]

      expect(() =>
        upsertSavedProcess([], createSnapshot({ sections })),
      ).toThrow(`Brakuje wymaganej sekcji procesu: ${missingKey}.`)
    })

    it('odrzuca nieprawidłowy typ sekcji', () => {
      expect(() =>
        upsertSavedProcess(
          [],
          createSnapshot({ sections: createSections({ report: 123 }) }),
        ),
      ).toThrow(TypeError)
    })

    it('odrzuca uszkodzony JSON sekcji', () => {
      expect(() =>
        upsertSavedProcess(
          [],
          createSnapshot({ sections: createSections({ report: '{invalid' }) }),
        ),
      ).toThrow('Sekcja report musi zawierać poprawny JSON.')
    })

    it.each([
      ['tablicę', '[]'],
      ['liczbę', '123'],
      ['string', '"value"'],
      ['wartość logiczną', 'true'],
      ['null', 'null'],
    ])('odrzuca JSON sekcji reprezentujący %s', (_description, report) => {
      expect(() =>
        upsertSavedProcess(
          [],
          createSnapshot({ sections: createSections({ report }) }),
        ),
      ).toThrow('JSON sekcji report musi reprezentować obiekt.')
    })
  })

  describe('dodawanie', () => {
    it('dodaje dokładnie jeden proces do pustej biblioteki', () => {
      const snapshot = createSnapshot()

      const result = upsertSavedProcess([], snapshot)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(snapshot)
    })

    it('dodaje proces na końcu niepustej biblioteki', () => {
      const existingProcess = createSnapshot({ id: otherProcessId })

      const result = upsertSavedProcess([existingProcess], createSnapshot())

      expect(result).toHaveLength(2)
      expect(result[0]).toBe(existingProcess)
      expect(result[1].id).toBe(processId)
    })

    it('zwraca nową tablicę oraz kopie snapshotu i sections', () => {
      const processes = []
      const snapshot = createSnapshot()

      const result = upsertSavedProcess(processes, snapshot)

      expect(result).not.toBe(processes)
      expect(result[0]).not.toBe(snapshot)
      expect(result[0].sections).not.toBe(snapshot.sections)
      expect(result[0]).toEqual(snapshot)
    })
  })

  describe('aktualizacja', () => {
    it('zastępuje pojedynczy rekord z tym samym UUID', () => {
      const existingProcess = createSnapshot({ name: 'Stara nazwa' })
      const snapshot = createSnapshot({ name: 'Nowa nazwa' })

      const result = upsertSavedProcess([existingProcess], snapshot)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(snapshot)
      expect(result[0]).not.toBe(existingProcess)
    })

    it('zachowuje indeks, kolejność i wszystkie inne rekordy', () => {
      const firstProcess = createSnapshot({ id: otherProcessId, name: 'Pierwszy' })
      const updatedProcess = createSnapshot({ name: 'Przed zmianą' })
      const lastProcess = createSnapshot({ id: thirdProcessId, name: 'Ostatni' })
      const processes = [firstProcess, updatedProcess, lastProcess]

      const result = upsertSavedProcess(
        processes,
        createSnapshot({ name: 'Po zmianie' }),
      )

      expect(result).toHaveLength(3)
      expect(result[0]).toBe(firstProcess)
      expect(result[1].name).toBe('Po zmianie')
      expect(result[2]).toBe(lastProcess)
    })

    it('nie modyfikuje wejściowej tablicy ani starego rekordu', () => {
      const existingProcess = Object.freeze(createSnapshot({ name: 'Stara nazwa' }))
      const processes = Object.freeze([existingProcess])

      const result = upsertSavedProcess(
        processes,
        createSnapshot({ name: 'Nowa nazwa' }),
      )

      expect(processes[0]).toBe(existingProcess)
      expect(existingProcess.name).toBe('Stara nazwa')
      expect(result).not.toBe(processes)
      expect(result[0].name).toBe('Nowa nazwa')
    })

    it('dopasowuje UUID bez uwzględniania wielkości liter', () => {
      const existingProcess = createSnapshot({ id: processId.toUpperCase() })

      const result = upsertSavedProcess(
        [existingProcess],
        createSnapshot({ name: 'Zaktualizowany' }),
      )

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Zaktualizowany')
    })

    it('traktuje tę samą nazwę z innym UUID jako osobny proces', () => {
      const existingProcess = createSnapshot({ id: otherProcessId })

      const result = upsertSavedProcess([existingProcess], createSnapshot())

      expect(result).toHaveLength(2)
      expect(result[0]).toBe(existingProcess)
      expect(result[1].id).toBe(processId)
    })

    it('aktualizuje wyłącznie rekord odpowiadający UUID', () => {
      const sameName = 'Wspólna nazwa'
      const firstProcess = createSnapshot({ id: otherProcessId, name: sameName })
      const targetProcess = createSnapshot({ name: sameName })
      const processes = [firstProcess, targetProcess]

      const result = upsertSavedProcess(
        processes,
        createSnapshot({ name: 'Zmieniona nazwa' }),
      )

      expect(result[0]).toBe(firstProcess)
      expect(result[1].name).toBe('Zmieniona nazwa')
    })

    it('zachowuje dodatkowe pola snapshotu i sections', () => {
      const snapshot = createSnapshot({
        metadata: { version: 1 },
        sections: createSections({ customSection: 'legacy-value' }),
      })

      const result = upsertSavedProcess([], snapshot)

      expect(result[0].metadata).toBe(snapshot.metadata)
      expect(result[0].sections.customSection).toBe('legacy-value')
    })
  })

  describe('duplikaty i dane uszkodzone', () => {
    it('odrzuca dwa identyczne UUID', () => {
      const processes = [createSnapshot(), createSnapshot()]

      expect(() => upsertSavedProcess(processes, createSnapshot())).toThrow(
        `Biblioteka zawiera powielony identyfikator procesu: ${processId}.`,
      )
    })

    it('odrzuca duplikat różniący się tylko wielkością liter', () => {
      const processes = [
        createSnapshot(),
        createSnapshot({ id: processId.toUpperCase() }),
      ]

      expect(() => upsertSavedProcess(processes, createSnapshot())).toThrow(
        `Biblioteka zawiera powielony identyfikator procesu: ${processId}.`,
      )
    })

    it('odrzuca duplikat niezwiązany ze snapshot.id', () => {
      const processes = [
        createSnapshot({ id: otherProcessId }),
        createSnapshot({ id: otherProcessId }),
      ]

      expect(() => upsertSavedProcess(processes, createSnapshot())).toThrow(
        `Biblioteka zawiera powielony identyfikator procesu: ${otherProcessId}.`,
      )
    })

    it('nie zmienia wejścia po błędzie duplikatu', () => {
      const firstSections = Object.freeze(createSections())
      const secondSections = Object.freeze(createSections())
      const snapshotSections = Object.freeze(createSections())
      const snapshotMetadata = Object.freeze({ source: 'test' })
      const firstProcess = Object.freeze(
        createSnapshot({ sections: firstSections }),
      )
      const secondProcess = Object.freeze(
        createSnapshot({ sections: secondSections }),
      )
      const processes = Object.freeze([firstProcess, secondProcess])
      const snapshot = Object.freeze(
        createSnapshot({
          name: 'Nowa nazwa',
          sections: snapshotSections,
          metadata: snapshotMetadata,
        }),
      )

      expect(() => upsertSavedProcess(processes, snapshot)).toThrow()
      expect(processes).toEqual([firstProcess, secondProcess])
      expect(processes[0]).toBe(firstProcess)
      expect(processes[1]).toBe(secondProcess)
      expect(firstProcess.sections).toBe(firstSections)
      expect(secondProcess.sections).toBe(secondSections)
      expect(firstProcess.sections.scope).toBe(firstSections.scope)
      expect(secondProcess.sections.scope).toBe(secondSections.scope)
      expect(firstProcess.name).toBe('Proces testowy')
      expect(secondProcess.name).toBe('Proces testowy')
      expect(snapshot.name).toBe('Nowa nazwa')
      expect(snapshot.sections).toBe(snapshotSections)
      expect(snapshot.sections.scope).toBe(snapshotSections.scope)
      expect(snapshot.metadata).toBe(snapshotMetadata)
      expect(snapshot.metadata.source).toBe('test')
    })

    it('nie traktuje dwóch takich samych nieprawidłowych ID jako duplikatu UUID', () => {
      const firstInvalid = { id: 'invalid', name: 'Uszkodzony pierwszy' }
      const secondInvalid = { id: 'invalid', name: 'Uszkodzony drugi' }

      const result = upsertSavedProcess(
        [firstInvalid, secondInvalid],
        createSnapshot(),
      )

      expect(result).toHaveLength(3)
      expect(result[0]).toBe(firstInvalid)
      expect(result[1]).toBe(secondInvalid)
      expect(result[2].id).toBe(processId)
    })

    it('zachowuje null i rekordy bez poprawnego ID', () => {
      const withoutId = { name: 'Bez ID' }
      const invalidId = { id: 'invalid', name: 'Błędne ID' }
      const processes = [null, withoutId, invalidId]

      const result = upsertSavedProcess(processes, createSnapshot())

      expect(result).toHaveLength(4)
      expect(result[0]).toBeNull()
      expect(result[1]).toBe(withoutId)
      expect(result[2]).toBe(invalidId)
    })

    it('zastępuje pojedynczy uszkodzony rekord z poprawnym docelowym UUID', () => {
      const corruptedTarget = { id: processId, unexpected: true }
      const unrelatedCorrupted = { id: 'invalid', legacy: true }

      const result = upsertSavedProcess(
        [unrelatedCorrupted, corruptedTarget],
        createSnapshot({ name: 'Naprawiony proces' }),
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toBe(unrelatedCorrupted)
      expect(result[1].name).toBe('Naprawiony proces')
      expect(result[1]).not.toBe(corruptedTarget)
    })
  })
})
