// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('takes a fictional workshop from proposal through reopen, report and printing', async () => {
  const user = userEvent.setup()
  const transcript = 'HR sprawdza kompletność danych. Następnie biuro przygotowuje dokumenty.'
  const steps = ['Sprawdzenie kompletności danych', 'Przygotowanie dokumentów']
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const print = vi.spyOn(window, 'print').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ proposal: {
    steps: [{ text: steps[0], status: 'supported', evidence: 'HR sprawdza kompletność danych.' }, { text: steps[1], status: 'supported', evidence: 'biuro przygotowuje dokumenty.' }], roles: [], decisions: [], questions: [],
  } }) })))
  const view = render(<App />)
  await user.click(screen.getByRole('button', { name: /Dodaj kroki samodzielnie/ }))
  await user.type(screen.getByLabelText(/Nazwa procesu/), 'Fikcyjny obieg dokumentów')
  await user.type(screen.getByLabelText(/Cel procesu/), 'Terminowe przygotowanie dokumentów')
  await user.type(screen.getByLabelText(/Co rozpoczyna proces/), 'Wpłynięcie zgłoszenia')
  await user.type(screen.getByLabelText(/Co kończy proces/), 'Przekazanie dokumentów')
  await user.click(screen.getByRole('button', { name: /Zapisz zakres i przejdź dalej/ }))
  await user.type(screen.getByLabelText('Tekst rozmowy'), transcript)
  await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
  await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
  expect(await screen.findByLabelText('Kroki — pozycja 1')).toHaveProperty('value', steps[0])
  await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
  await user.click(screen.getByRole('checkbox', { name: 'Wybierz krok 1 do przeniesienia' }))
  await user.click(screen.getByRole('checkbox', { name: 'Wybierz krok 2 do przeniesienia' }))
  await user.click(screen.getByRole('button', { name: 'Przenieś wybrane kroki do AS-IS' }))
  await user.click(screen.getByRole('button', { name: 'Zapisz proces AS-IS' }))
  await user.click(screen.getByRole('button', { name: /Nowy proces/ }))
  view.unmount()
  sessionStorage.setItem('architekt-procesow-screen-to-open', 'processes')
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Otwórz proces' }))
  expect(screen.getByLabelText('Tekst rozmowy').value).toBe(transcript)
  expect(JSON.parse(localStorage.getItem('architekt-procesow:as-is')).steps.map((step) => step.name)).toEqual(steps)
  await user.click(screen.getByRole('button', { name: 'Przejdź do analizy' }))
  await user.selectOptions(screen.getByLabelText(/Kategoria/), 'Wąskie gardło')
  await user.type(screen.getByLabelText(/Nazwa problemu lub obserwacji/), 'Brak terminu przekazania')
  await user.type(screen.getByLabelText('Wstępny pomysł usprawnienia'), 'Ustalić wspólny termin')
  await user.click(screen.getByRole('button', { name: 'Dodaj ustalenie' }))
  await user.click(screen.getByRole('button', { name: 'Zapisz analizę' }))
  await user.click(screen.getByRole('button', { name: 'Przejdź do TO-BE' }))
  await user.type(screen.getByLabelText(/Cel projektowanej zmiany/), 'Ustalić termin przekazania')
  await user.click(screen.getByRole('button', { name: 'Skopiuj kroki z AS-IS' }))
  await user.click(screen.getByRole('button', { name: 'Zapisz proces TO-BE' }))
  await user.click(screen.getByRole('button', { name: 'Przejdź do raportu' }))
  await user.type(screen.getByLabelText(/Nazwa osoby, roli lub zespołu/), 'Koordynator HR')
  await user.click(screen.getByRole('button', { name: 'Dodaj interesariusza' }))
  for (const step of steps) await user.selectOptions(screen.getByLabelText(`${step}: Koordynator HR`), 'RA')
  await user.click(screen.getByRole('button', { name: 'Zapisz raport' }))
  expect(screen.getByText('Raport procesu został zapisany')).toBeTruthy()
  const report = screen.getByRole('heading', { name: 'Podsumuj proces i odpowiedzialności' }).closest('.report-workspace')
  expect(within(report).getAllByText('Brak terminu przekazania').length).toBeGreaterThan(0)
  expect(within(report).getAllByText('Ustalić termin przekazania').length).toBeGreaterThan(0)
  await user.click(screen.getByRole('button', { name: 'Eksportuj do PDF' }))
  await vi.waitFor(() => expect(print).toHaveBeenCalledOnce())
}, 20000)
