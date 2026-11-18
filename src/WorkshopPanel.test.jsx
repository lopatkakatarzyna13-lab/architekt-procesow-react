// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkshopPanel from './WorkshopPanel'
import { getLocalWorkshopDate, saveWorkshop, saveWorkshopReview } from './workshop'

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
    for (const [category, text] of [['kroki', 'Sprawdzenie danych'], ['role', 'HR'], ['systemy', 'SAP'], ['wyjątki', 'Brak danych'], ['decyzje', 'Czy dane są kompletne?'], ['pytania', 'Kto zatwierdza?']]) {
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
    expect(screen.getByLabelText('Systemy — pozycja 1').value).toBe('SAP')
    expect(screen.getByLabelText('Wyjątki — pozycja 1').value).toBe('Brak danych')
    await user.clear(screen.getByLabelText('Systemy — pozycja 1'))
    await user.type(screen.getByLabelText('Systemy — pozycja 1'), 'BPSC')
    await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
    second.unmount()
    const reopened = render(<WorkshopPanel processId={PROCESS_A} dirtyRef={dirtyRef} />)
    expect(screen.getByLabelText('Systemy — pozycja 1').value).toBe('BPSC')
    expect(screen.getByLabelText('Wyjątki — pozycja 1').value).toBe('Brak danych')
    reopened.unmount()
    render(<WorkshopPanel processId={PROCESS_B} dirtyRef={dirtyRef} />)
    expect(screen.getByLabelText('Tekst rozmowy').value).toBe('')
    expect(screen.queryByText('Propozycja do sprawdzenia')).toBeNull()
  })

  it('saves manual notes before a transcript and preserves them when text is added later', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const view = render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    await user.click(screen.getByRole('button', { name: 'Opracuj ręcznie' }))
    await user.click(screen.getByRole('button', { name: 'Dodaj: pytania' }))
    await user.type(screen.getByLabelText('Pytania — pozycja 1'), 'Kto zatwierdza?')
    await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
    expect(screen.getByText('Propozycja zapisana na tym urządzeniu.')).toBeTruthy()
    expect(screen.getByLabelText('Tekst rozmowy').value).toBe('')

    await user.type(screen.getByLabelText('Odpowiedź — pytanie 1'), 'Kadry')
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'Fragment dopisany po spotkaniu.')
    expect(screen.getByLabelText('Odpowiedź — pytanie 1').value).toBe('Kadry')
    expect(confirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
    await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
    view.unmount()

    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    expect(screen.getByLabelText('Pytania — pozycja 1').value).toBe('Kto zatwierdza?')
    expect(screen.getByLabelText('Odpowiedź — pytanie 1').value).toBe('Kadry')
    expect(screen.getByLabelText('Tekst rozmowy').value).toBe('Fragment dopisany po spotkaniu.')
    await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
    expect(confirm).toHaveBeenCalledWith('Nowa propozycja zastąpi bieżące ustalenia, w tym odpowiedzi na pytania, przypisane osoby i terminy. Kontynuować?')
    expect(screen.getByLabelText('Odpowiedź — pytanie 1').value).toBe('Kadry')
  })

  it('opens an older proposal and allows new categories to be added', async () => {
    const user = userEvent.setup()
    const transcript = 'HR sprawdza dane.'
    saveWorkshop(localStorage, PROCESS_A, transcript)
    saveWorkshopReview(localStorage, PROCESS_A, transcript, {
      steps: [{ text: 'Sprawdzenie danych', status: 'assumption', evidence: '' }], roles: [], decisions: [], questions: [],
    })
    const view = render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    expect(screen.getByLabelText('Kroki — pozycja 1').value).toBe('Sprawdzenie danych')
    await user.click(screen.getByRole('button', { name: 'Dodaj: systemy' }))
    await user.type(screen.getByLabelText('Systemy — pozycja 1'), 'SAP')
    await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
    view.unmount()
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    expect(screen.getByLabelText('Systemy — pozycja 1').value).toBe('SAP')
    expect(screen.getByLabelText('Kroki — pozycja 1').value).toBe('Sprawdzenie danych')
  })

  it('saves an explicit review decision and clears it when the text changes', async () => {
    const user = userEvent.setup()
    saveWorkshop(localStorage, PROCESS_A, 'HR używa SAP.')
    saveWorkshopReview(localStorage, PROCESS_A, 'HR używa SAP.', {
      steps: [], roles: [], decisions: [], questions: [{ text: 'Kto zatwierdza?', status: 'question' }],
      systems: [{ text: 'SAP', status: 'assumption' }], exceptions: [],
    })
    const view = render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    const systemCheck = screen.getByRole('checkbox', { name: 'Sprawdzono treść — systemy, pozycja 1' })
    const questionCheck = screen.getByRole('checkbox', { name: 'Sprawdzono treść — pytania, pozycja 1' })
    expect(systemCheck.checked).toBe(false)
    expect(questionCheck.checked).toBe(false)
    await user.click(systemCheck)
    await user.click(questionCheck)
    await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
    view.unmount()
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    expect(screen.getByRole('checkbox', { name: 'Sprawdzono treść — systemy, pozycja 1' }).checked).toBe(true)
    expect(screen.getByRole('checkbox', { name: 'Sprawdzono treść — pytania, pozycja 1' }).checked).toBe(true)
    await user.type(screen.getByLabelText('Systemy — pozycja 1'), ' HR')
    expect(screen.getByRole('checkbox', { name: 'Sprawdzono treść — systemy, pozycja 1' }).checked).toBe(false)
    expect(screen.getByRole('checkbox', { name: 'Sprawdzono treść — pytania, pozycja 1' }).checked).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
    cleanup()
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    expect(screen.getByRole('checkbox', { name: 'Sprawdzono treść — systemy, pozycja 1' }).checked).toBe(false)
    expect(screen.getByRole('checkbox', { name: 'Sprawdzono treść — pytania, pozycja 1' }).checked).toBe(true)
  })

  it('never trusts an AI response to mark its own proposal as checked', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ proposal: {
      steps: [{ text: 'Sprawdzenie danych', status: 'supported', evidence: 'HR sprawdza dane.', reviewed: true }],
      roles: [], decisions: [], questions: [{ text: 'Kto zatwierdza?', status: 'question', answer: 'AI', answerConfirmed: true, assignee: 'AI', dueDate: '2028-02-29' }],
    } }) })))
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'HR sprawdza dane.')
    await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
    expect((await screen.findByRole('checkbox', { name: 'Sprawdzono treść — kroki, pozycja 1' })).checked).toBe(false)
    expect(screen.getByLabelText('Odpowiedź — pytanie 1').value).toBe('')
    expect(screen.getByLabelText('Kto wróci z odpowiedzią — pytanie 1').value).toBe('')
    expect(screen.getByLabelText('Termin odpowiedzi — pytanie 1').value).toBe('')
    expect(screen.getByRole('checkbox', { name: 'Potwierdzono odpowiedź — pytanie 1' }).checked).toBe(false)
  })

  it('restores open and confirmed questions and reopens an edited answer', async () => {
    const user = userEvent.setup()
    const transcript = 'HR przekazuje dokumenty.'
    saveWorkshop(localStorage, PROCESS_A, transcript)
    saveWorkshopReview(localStorage, PROCESS_A, transcript, {
      steps: [], roles: [], decisions: [], questions: [
        { text: 'Kiedy?', status: 'question' },
        { text: 'Do kogo?', status: 'question' },
      ],
    })
    const view = render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    const confirmation = () => screen.getByRole('checkbox', { name: 'Potwierdzono odpowiedź — pytanie 1' })
    expect(confirmation().disabled).toBe(true)
    await user.type(screen.getByLabelText('Odpowiedź — pytanie 1'), 'W piątek')
    await user.click(confirmation())
    await user.type(screen.getByLabelText('Kto wróci z odpowiedzią — pytanie 1'), 'Zespół HR')
    expect(confirmation().checked).toBe(true)
    expect(screen.getByText(/Otwarte pytania: 1 z 2/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
    view.unmount()

    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    expect(confirmation().checked).toBe(true)
    expect(screen.getByText(/Otwarte pytania: 1 z 2/)).toBeTruthy()
    expect(screen.getByLabelText('Odpowiedź — pytanie 1').value).toBe('W piątek')
    expect(screen.getByLabelText('Kto wróci z odpowiedzią — pytanie 1').value).toBe('Zespół HR')
    await user.type(screen.getByLabelText('Pytania — pozycja 1'), ' dokładnie?')
    expect(confirmation().checked).toBe(false)
    expect(screen.getByLabelText('Odpowiedź — pytanie 1').value).toBe('W piątek')
    await user.click(confirmation())
    await user.type(screen.getByLabelText('Odpowiedź — pytanie 1'), ' rano')
    expect(confirmation().checked).toBe(false)
    expect(screen.getByText(/Otwarte pytania: 2 z 2/)).toBeTruthy()
  })

  it('filters closed questions and marks only open questions with a past due date', async () => {
    const user = userEvent.setup()
    const today = getLocalWorkshopDate()
    saveWorkshopReview(localStorage, PROCESS_A, '', {
      steps: [], roles: [], decisions: [], questions: [
        { text: 'Zamknięte?', status: 'question', dueDate: '2000-01-01', answer: 'Tak', answerConfirmed: true },
        { text: 'Po terminie?', status: 'question', dueDate: '2000-01-01', answer: 'Wstępnie tak' },
        { text: 'Termin dzisiaj?', status: 'question', dueDate: today },
        { text: 'Bez daty?', status: 'question' },
      ],
    })
    const dirtyRef = { current: false }
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={dirtyRef} />)
    const toggle = screen.getByRole('checkbox', { name: 'Pokaż tylko otwarte pytania' })
    expect(screen.getByText(/Po terminie: 1/)).toBeTruthy()
    expect(screen.getAllByText('Po terminie')).toHaveLength(1)
    await user.click(toggle)
    expect(dirtyRef.current).toBe(false)
    expect(screen.queryByRole('textbox', { name: 'Pytania — pozycja 1' })).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Pytania — pozycja 2' }).value).toBe('Po terminie?')
    await user.click(screen.getByRole('checkbox', { name: 'Potwierdzono odpowiedź — pytanie 2' }))
    expect(screen.queryByRole('textbox', { name: 'Pytania — pozycja 2' })).toBeNull()
    expect(screen.queryByText('Po terminie')).toBeNull()
    expect(document.activeElement).toBe(toggle)
    await user.click(toggle)
    expect(screen.getByRole('textbox', { name: 'Pytania — pozycja 1' }).value).toBe('Zamknięte?')
    expect(screen.getByRole('textbox', { name: 'Pytania — pozycja 2' }).value).toBe('Po terminie?')
  })

  it('keeps a saved answer if the user declines to replace the workshop review', async () => {
    const user = userEvent.setup()
    const transcript = 'HR przekazuje dokumenty.'
    saveWorkshop(localStorage, PROCESS_A, transcript)
    saveWorkshopReview(localStorage, PROCESS_A, transcript, {
      steps: [], roles: [], decisions: [],
      questions: [{ text: 'Kiedy?', status: 'question', answer: 'W piątek', answerConfirmed: true }],
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    await user.click(screen.getByRole('button', { name: 'Opracuj ręcznie' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('odpowiedzi na pytania'))
    expect(screen.getByLabelText('Odpowiedź — pytanie 1').value).toBe('W piątek')
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
    expect(within(row).getByText('Źródło propozycji: cytat z rozmowy')).toBeTruthy()
    await user.type(field, ' ręcznie')
    expect(within(row).getByText('Źródło propozycji: założenie lub wpis ręczny')).toBeTruthy()
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
    expect(await screen.findByText(/Osiągnięto limit analiz AI/)).toBeTruthy()
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

  it('explains a provider billing limit and keeps manual work available', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({ error: 'PROVIDER_BILLING_LIMIT' }) })))
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'Fikcyjny proces')
    await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
    expect(await screen.findByText(/Sprawdź rozliczenia przed kolejną próbą/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Opracuj ręcznie' }))
    expect(screen.getByText('Propozycja do sprawdzenia')).toBeTruthy()
  })

  it('keeps manual editing available when the usage counter is unavailable', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: 'USAGE_STORAGE_UNAVAILABLE' }) })))
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'Fikcyjny proces.')
    await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
    expect(await screen.findByText(/Nie można sprawdzić licznika/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Opracuj ręcznie' }))
    await user.click(screen.getByRole('button', { name: 'Dodaj: kroki' }))
    await user.type(screen.getByLabelText('Kroki — pozycja 1'), 'Ręczna weryfikacja')
    expect(screen.getByLabelText('Kroki — pozycja 1').value).toBe('Ręczna weryfikacja')
  })

  it('requires saving and selecting an AI proposal before transferring it', async () => {
    const user = userEvent.setup()
    const transfer = vi.fn(() => ({ added: 1, skipped: 0 }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ proposal: {
      steps: [{ text: 'Fikcyjny krok', status: 'supported', evidence: 'fragment rozmowy' }], roles: [], decisions: [], questions: [],
    } }) })))
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} canTransferSteps onTransferSteps={transfer} />)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'Fikcyjny fragment rozmowy')
    await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
    await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
    expect(await screen.findByText(/Cytat pomaga odnaleźć fragment rozmowy/)).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Przenieś wybrane kroki do AS-IS' })
    expect(button.disabled).toBe(true)
    await user.click(screen.getByRole('checkbox', { name: 'Wybierz krok 1 do przeniesienia' }))
    expect(button.disabled).toBe(true)
    expect(transfer).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
    await user.click(button)
    expect(transfer).toHaveBeenCalledWith(['Fikcyjny krok'])
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

  it('blocks further edits if deletion and restoration both fail', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<WorkshopPanel processId={PROCESS_A} dirtyRef={{ current: false }} />)
    await user.type(screen.getByLabelText('Tekst rozmowy'), 'Fikcyjny tekst do odzyskania')
    await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
    const remove = Storage.prototype.removeItem
    const set = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (key.endsWith(':review')) throw Error('fixture remove failed')
      return remove.call(this, key)
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === `architekt-procesow:workshop:${PROCESS_A}`) throw Error('fixture restore failed')
      return set.call(this, key, value)
    })
    await user.click(screen.getByRole('button', { name: 'Usuń dane warsztatu' }))
    expect(screen.getByRole('alert').textContent).toContain('Edycja została wstrzymana')
    expect(screen.getByLabelText(/Tekst dostępny w tym oknie/).value).toBe('Fikcyjny tekst do odzyskania')
    expect(screen.queryByRole('button', { name: 'Zapisz transkrypcję' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Analizuj transkrypcję' })).toBeNull()
  })

})
