// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const library = 'architekt-procesow:processes'
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it.each(['{uszkodzony JSON', 'null', '{}', ''])('does not overwrite an unreadable library on start or starting a new process: %s', async (broken) => {
  const user = userEvent.setup()
  localStorage.setItem(library, broken)
  sessionStorage.setItem('architekt-procesow-screen-to-open', 'processes')
  render(<App />)
  expect(screen.getByRole('alert').textContent).toContain('nie został nadpisany')
  expect(screen.queryByText('Nie masz jeszcze zapisanych procesów')).toBeNull()
  expect(localStorage.getItem(library)).toBe(broken)
  await user.click(screen.getByRole('button', { name: /Nowy proces/ }))
  expect(localStorage.getItem(library)).toBe(broken)
  expect(screen.getAllByRole('alert').some((item) => item.textContent.includes('nie został nadpisany'))).toBe(true)
})

it('does not overwrite a library changed in another tab when saving the current process', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  localStorage.setItem(library, '[]')
  localStorage.setItem('architekt-procesow:scope', JSON.stringify({ data: { processName: 'Bieżący proces' } }))
  render(<App />)
  const external = JSON.stringify([{ id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Inny proces' }])
  localStorage.setItem(library, external)
  await user.click(screen.getByRole('button', { name: /Nowy proces/ }))
  expect(localStorage.getItem(library)).toBe(external)
  expect(screen.getByRole('alert').textContent).toContain('Proces nie został zapisany ani zresetowany')
})
