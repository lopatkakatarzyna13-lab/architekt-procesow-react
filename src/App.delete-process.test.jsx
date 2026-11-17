// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const B = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const key = (id) => `architekt-procesow:workshop:${id}`
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('requires confirmation and deletes only the selected inactive process and workshop', async () => {
  const user = userEvent.setup()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  localStorage.setItem('architekt-procesow:processes', JSON.stringify([{ id: A, name: 'Pierwszy', savedAt: '2026-11-17T10:00:00.000Z' }, { id: B, name: 'Drugi', savedAt: '2026-11-17T10:00:00.000Z' }]))
  localStorage.setItem('architekt-procesow:current-process-id', B)
  localStorage.setItem(key(A), 'fikcyjny tekst A')
  localStorage.setItem(`${key(A)}:review`, 'fikcyjna propozycja A')
  localStorage.setItem(key(B), 'fikcyjny tekst B')
  sessionStorage.setItem('architekt-procesow-screen-to-open', 'processes')
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Usuń proces Pierwszy' }))
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('nie można cofnąć'))
  expect(localStorage.getItem(key(A))).toBe('fikcyjny tekst A')
  confirm.mockReturnValue(true)
  await user.click(screen.getByRole('button', { name: 'Usuń proces Pierwszy' }))
  expect(screen.queryByRole('button', { name: 'Usuń proces Pierwszy' })).toBeNull()
  expect(localStorage.getItem(key(A))).toBeNull()
  expect(localStorage.getItem(`${key(A)}:review`)).toBeNull()
  expect(localStorage.getItem(key(B))).toBe('fikcyjny tekst B')
  expect(JSON.parse(localStorage.getItem('architekt-procesow:processes')).map((p) => p.id)).toEqual([B])
  await user.click(screen.getByRole('button', { name: 'Usuń proces Drugi' }))
  expect(screen.getByText(/To obecnie otwarty proces/)).toBeTruthy()
  expect(localStorage.getItem(key(B))).toBe('fikcyjny tekst B')
})
