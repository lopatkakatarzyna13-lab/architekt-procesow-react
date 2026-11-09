// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createTestGateway } from '../experiments/supabase-auth/test-gateway'

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('saves and reopens an AI-assisted process through the isolated test gateway', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const reserve = vi.fn(async () => true)
  const gateway = createTestGateway({
    verify: async (token) => token === 'synthetic', reserve,
    analyze: async () => ({ steps: [{ text: 'Sprawdzenie danych', status: 'supported', evidence: 'HR sprawdza dane' }], roles: [], decisions: [], questions: [] }),
  })
  // The harness supplies synthetic authentication. This is not a production login.
  vi.stubGlobal('fetch', vi.fn((url, init) => gateway(new Request(new URL(url, 'http://localhost'), { ...init, headers: { ...init.headers, authorization: 'Bearer synthetic' } }))))
  const view = render(<App />)
  await user.click(screen.getByRole('button', { name: /Dodaj kroki samodzielnie/ }))
  await user.type(screen.getByLabelText(/Nazwa procesu/), 'Fikcyjny proces AI')
  await user.type(screen.getByLabelText(/Cel procesu/), 'Przygotowanie danych')
  await user.type(screen.getByLabelText(/Co rozpoczyna proces/), 'Zgłoszenie')
  await user.type(screen.getByLabelText(/Co kończy proces/), 'Przekazanie')
  await user.click(screen.getByRole('button', { name: /Zapisz zakres i przejdź dalej/ }))
  await user.type(await screen.findByLabelText('Tekst rozmowy'), 'HR sprawdza dane')
  await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
  await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
  expect((await screen.findByLabelText('Kroki — pozycja 1')).value).toBe('Sprawdzenie danych')
  expect(reserve).toHaveBeenCalledOnce()
  await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
  await user.click(screen.getByRole('checkbox', { name: 'Wybierz krok 1 do przeniesienia' }))
  await user.click(screen.getByRole('button', { name: 'Przenieś wybrane kroki do AS-IS' }))
  await user.click(screen.getByRole('button', { name: 'Zapisz proces AS-IS' }))
  expect(screen.getByText('Proces AS-IS został zapisany')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: /Nowy proces/ }))
  view.unmount()
  sessionStorage.setItem('architekt-procesow-screen-to-open', 'processes')
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Otwórz proces' }))
  expect(screen.getByLabelText('Tekst rozmowy').value).toBe('HR sprawdza dane')
  expect(JSON.parse(localStorage.getItem('architekt-procesow:as-is')).steps.map((step) => step.name)).toEqual(['Sprawdzenie danych'])
})
