import { describe, expect, it } from 'vitest'
import { buildProcessSnapshot } from './processSnapshot'

const currentId = '123e4567-e89b-42d3-a456-426614174000'
const currentSavedAt = '2026-08-04T12:00:00.000Z'

function createSections(overrides = {}) {
  return {
    scope: '{"scope":"current"}',
    asIs: '{"asIs":"current"}',
    analysis: '{"analysis":"current"}',
    toBe: '{"toBe":"current"}',
    report: '{"report":"current"}',
    ...overrides,
  }
}

function createInput(overrides = {}) {
  return {
    id: currentId,
    name: 'Aktualny proces',
    savedAt: currentSavedAt,
    lastScreen: 'report',
    sections: createSections(),
    ...overrides,
  }
}

describe('buildProcessSnapshot', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('buduje nowy snapshot, gdy existingProcess to %s', (_description, existingProcess) => {
    const input = createInput({ existingProcess })

    const result = buildProcessSnapshot(input)

    expect(result).toEqual({
      id: currentId,
      name: 'Aktualny proces',
      savedAt: currentSavedAt,
      lastScreen: 'report',
      sections: createSections(),
    })
  })

  it('zachowuje dodatkowe pole istniejącego procesu', () => {
    const metadata = { source: 'legacy' }
    const existingProcess = {
      metadata,
      sections: createSections(),
    }

    const result = buildProcessSnapshot(createInput({ existingProcess }))

    expect(result.metadata).toBe(metadata)
  })

  it('zachowuje dodatkową sekcję istniejącego procesu', () => {
    const customSection = { legacy: true }
    const existingProcess = {
      sections: {
        ...createSections(),
        customSection,
      },
    }

    const result = buildProcessSnapshot(createInput({ existingProcess }))

    expect(result.sections.customSection).toBe(customSection)
  })

  it('nadpisuje aktualnymi wartościami id, name, savedAt i lastScreen', () => {
    const existingProcess = {
      id: '7d444840-9dc0-4f5c-b245-5b7b4de43f01',
      name: 'Stary proces',
      savedAt: '2025-01-01T00:00:00.000Z',
      lastScreen: 'scope',
      sections: createSections(),
    }

    const result = buildProcessSnapshot(createInput({ existingProcess }))

    expect(result).toMatchObject({
      id: currentId,
      name: 'Aktualny proces',
      savedAt: currentSavedAt,
      lastScreen: 'report',
    })
  })

  it('nadpisuje wszystkie pięć standardowych sekcji', () => {
    const existingProcess = {
      sections: {
        scope: '{"scope":"old"}',
        asIs: '{"asIs":"old"}',
        analysis: '{"analysis":"old"}',
        toBe: '{"toBe":"old"}',
        report: '{"report":"old"}',
      },
    }
    const sections = createSections()

    const result = buildProcessSnapshot(
      createInput({ existingProcess, sections }),
    )

    expect(result.sections).toMatchObject(sections)
  })

  it('zachowuje null jako aktualną wartość sekcji', () => {
    const sections = createSections({
      analysis: null,
      toBe: null,
      report: null,
    })

    const result = buildProcessSnapshot(createInput({ sections }))

    expect(result.sections.analysis).toBeNull()
    expect(result.sections.toBe).toBeNull()
    expect(result.sections.report).toBeNull()
  })

  it('zawsze tworzy nowy obiekt snapshotu i nowy obiekt sections', () => {
    const existingProcess = { sections: createSections() }
    const sections = createSections()

    const result = buildProcessSnapshot(
      createInput({ existingProcess, sections }),
    )

    expect(result).not.toBe(existingProcess)
    expect(result.sections).not.toBe(existingProcess.sections)
    expect(result.sections).not.toBe(sections)
  })

  it('nie modyfikuje existingProcess, jego sections ani przekazanych sections', () => {
    const existingSections = Object.freeze({
      ...createSections(),
      customSection: 'legacy',
    })
    const existingProcess = Object.freeze({
      id: '7d444840-9dc0-4f5c-b245-5b7b4de43f01',
      name: 'Stary proces',
      savedAt: '2025-01-01T00:00:00.000Z',
      lastScreen: 'scope',
      sections: existingSections,
    })
    const sections = Object.freeze(createSections({ report: null }))

    const result = buildProcessSnapshot(
      createInput({ existingProcess, sections }),
    )

    expect(existingProcess.name).toBe('Stary proces')
    expect(existingProcess.sections).toBe(existingSections)
    expect(existingProcess.sections.customSection).toBe('legacy')
    expect(sections.report).toBeNull()
    expect(result.name).toBe('Aktualny proces')
    expect(result.sections.customSection).toBe('legacy')
    expect(result.sections.report).toBeNull()
  })

  it('zachowuje zagnieżdżone dodatkowe dane bez ich kopiowania ani usuwania', () => {
    const nestedMetadata = {
      audit: {
        createdBy: 'legacy-user',
      },
    }
    const customSection = {
      settings: {
        enabled: true,
      },
    }
    const existingProcess = {
      metadata: nestedMetadata,
      sections: {
        ...createSections(),
        customSection,
      },
    }

    const result = buildProcessSnapshot(createInput({ existingProcess }))

    expect(result.metadata).toBe(nestedMetadata)
    expect(result.metadata.audit).toBe(nestedMetadata.audit)
    expect(result.sections.customSection).toBe(customSection)
    expect(result.sections.customSection.settings).toBe(customSection.settings)
  })
})
