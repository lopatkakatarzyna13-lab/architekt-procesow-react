// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('starts a process and prevents leaving AS-IS with an unsaved workshop review', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<App />)
  await user.click(screen.getByRole('button', { name: /Opisz cały proces/ }))
  await user.type(screen.getByLabelText(/Nazwa procesu/), 'Proces testowy')
  await user.type(screen.getByLabelText(/Cel procesu/), 'Przygotowanie danych')
  await user.type(screen.getByLabelText(/Co rozpoczyna proces/), 'Zgłoszenie')
  await user.type(screen.getByLabelText(/Co kończy proces/), 'Przekazanie')
  await user.click(screen.getByRole('button', { name: /Zapisz zakres i przejdź dalej/ }))
  const transcript = await screen.findByLabelText('Tekst rozmowy')
  await user.type(transcript, 'HR sprawdza dane.')
  await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
  await user.click(screen.getByRole('button', { name: 'Opracuj ręcznie' }))
  await user.click(screen.getByRole('button', { name: 'Dodaj: kroki' }))
  await user.type(screen.getByLabelText('Kroki — pozycja 1'), 'Sprawdzenie danych')
  await user.click(screen.getByRole('button', { name: /Wróć do zakresu/ }))
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('niezapisane zmiany'))
  expect(screen.getByLabelText('Kroki — pozycja 1').value).toBe('Sprawdzenie danych')
})
