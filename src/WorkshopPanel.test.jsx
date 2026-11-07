// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkshopPanel from './WorkshopPanel'

const PROCESS_A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const PROCESS_B = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('workshop review screen', () => {
  it('saves and reopens a transcript and manually prepared proposal for the correct process', async () => {
    const user = userEvent.setup()
    const dirtyRef = { current: false }
    const first = render(<WorkshopPanel processId={PROCESS_A} dirtyRef={dirtyRef} />)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'HR sprawdza dane.')
    expect(dirtyRef.current).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
    await user.click(screen.getByRole('button', { name: 'Opracuj ręcznie' }))
    for (const [category, text] of [['kroki', 'Sprawdzenie danych'], ['role', 'HR'], ['decyzje', 'Czy dane są kompletne?'], ['pytania', 'Kto zatwierdza?']]) {
      await user.click(screen.getByRole('button', { name: `Dodaj: ${category}` }))
      const title = category[0].toUpperCase() + category.slice(1)
      await user.type(screen.getByLabelText(`${title} — pozycja 1`), text)
    }
    await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
    expect(screen.getByText('Propozycja zapisana na tym urządzeniu.')).toBeTruthy()
    expect(dirtyRef.current).toBe(false)
    first.unmount()
    const second = render(<WorkshopPanel processId={PROCESS_A} dirtyRef={dirtyRef} />)
    expect(screen.getByLabelText('Tekst rozmowy').value).toBe('HR sprawdza dane.')
    expect(screen.getByLabelText('Kroki — pozycja 1').value).toBe('Sprawdzenie danych')
    expect(screen.getByLabelText('Pytania — pozycja 1').value).toBe('Kto zatwierdza?')
    second.unmount()
    render(<WorkshopPanel processId={PROCESS_B} dirtyRef={dirtyRef} />)
    expect(screen.getByLabelText('Tekst rozmowy').value).toBe('')
    expect(screen.queryByText('Propozycja do sprawdzenia')).toBeNull()
  })

  it('keeps unsaved review if the user cancels changing the transcript', async () => {
    const user = userEvent.setup()
    const dirtyRef = { current: false }
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={dirtyRef} />)
    const input = screen.getByLabelText('Tekst rozmowy')
    await user.type(input, 'Test')
    await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
    await user.click(screen.getByRole('button', { name: 'Opracuj ręcznie' }))
    await user.click(screen.getByRole('button', { name: 'Dodaj: kroki' }))
    await user.type(screen.getByLabelText('Kroki — pozycja 1'), 'Krok roboczy')
    await user.click(input)
    await user.keyboard('a')
    expect(window.confirm).toHaveBeenCalled()
    expect(input.value).toBe('Test')
    expect(screen.getByLabelText('Kroki — pozycja 1').value).toBe('Krok roboczy')
    expect(dirtyRef.current).toBe(true)
  })

  it('marks an edited AI suggestion for review without presenting it as supported', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ proposal: {
      steps: [{ text: 'Sprawdzenie danych', status: 'supported', evidence: 'HR sprawdza dane.' }], roles: [], decisions: [], questions: [],
    } }) })))
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'HR sprawdza dane.')
    await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
    const field = await screen.findByLabelText('Kroki — pozycja 1')
    const row = field.closest('li')
    expect(within(row).getByText('Propozycja z cytatem do sprawdzenia')).toBeTruthy()
    await user.type(field, ' ręcznie')
    expect(within(row).getByText('Do sprawdzenia')).toBeTruthy()
    expect(within(row).getByText('Fragment rozmowy: HR sprawdza dane.')).toBeTruthy()
  })
  it('explains the AI usage limit and keeps manual workshop editing available', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 429, json: async () => ({ error: 'LIMIT_REACHED' }),
    })))
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'Fikcyjny proces testowy.')
    await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
    expect(await screen.findByText(/Osiągnięto limit 12 prób analizy AI/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Opracuj ręcznie' }))
    expect(screen.getByText('Propozycja do sprawdzenia')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Dodaj: kroki' }))
    await user.type(screen.getByLabelText('Kroki — pozycja 1'), 'Sprawdzenie dokumentów')
    expect(screen.getByLabelText('Kroki — pozycja 1').value).toBe('Sprawdzenie dokumentów')
  })

  it('explains that another AI analysis is already in progress', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 429, json: async () => ({ error: 'BUSY' }),
    })))
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'Fikcyjny proces.')
    await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
    expect(await screen.findByText(/Trwa już analiza AI/)).toBeTruthy()
  })

  it('deletes only workshop text after confirmation and keeps saved AS-IS', async () => {
    const user = userEvent.setup()
    const approve = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const id = PROCESS_A
    localStorage.setItem('architekt-procesow:processes', JSON.stringify([{ id, name: 'Proces testowy' }]))
    localStorage.setItem('architekt-procesow:as-is', JSON.stringify({ steps: [{ name: 'Weryfikacja' }] }))
    render(<WorkshopPanel processId={id} dirtyRef={{ current: false }} />)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'HR sprawdza dane.')
    await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
    await user.click(screen.getByRole('button', { name: 'Opracuj ręcznie' }))
    await user.click(screen.getByRole('button', { name: 'Dodaj: kroki' }))
    await user.type(screen.getByLabelText('Kroki — pozycja 1'), 'Sprawdzenie danych')
    await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
    await user.click(screen.getByRole('button', { name: 'Usuń dane warsztatu' }))
    expect(approve).toHaveBeenCalledWith(expect.stringContaining('Tej operacji nie można cofnąć'))
    expect(screen.getByLabelText('Tekst rozmowy').value).toBe('')
    expect(screen.queryByLabelText('Kroki — pozycja 1')).toBeNull()
    expect(localStorage.getItem(`architekt-procesow:workshop:${id}`)).toBeNull()
    expect(localStorage.getItem(`architekt-procesow:workshop:${id}:review`)).toBeNull()
    expect(JSON.parse(localStorage.getItem('architekt-procesow:processes'))).toHaveLength(1)
    expect(localStorage.getItem('architekt-procesow:as-is')).toContain('Weryfikacja')
  })

  it('lets the user clear an unreadable local workshop and start again', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    localStorage.setItem(`architekt-procesow:workshop:${PROCESS_A}`, '{broken')
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    expect(screen.getByLabelText('Tekst rozmowy').disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Usuń dane warsztatu' }))
    expect(localStorage.getItem(`architekt-procesow:workshop:${PROCESS_A}`)).toBeNull()
    expect(screen.getByLabelText('Tekst rozmowy').disabled).toBe(false)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'Nowe dane testowe')
    await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
    expect(screen.getByText('Transkrypcja zapisana na tym urządzeniu.')).toBeTruthy()
  })

  it('does not delete workshops without explicit consent', async () => {
    const user = userEvent.setup()
    const refuse = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'Dane fikcyjne.')
    await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
    await user.click(screen.getByRole('button', { name: 'Usuń dane warsztatu' }))
    expect(refuse).toHaveBeenCalled()
    expect(screen.getByLabelText('Tekst rozmowy').value).toBe('Dane fikcyjne.')
    expect(localStorage.getItem(`architekt-procesow:workshop:${PROCESS_A}`)).toContain('Dane fikcyjne.')
  })

})
