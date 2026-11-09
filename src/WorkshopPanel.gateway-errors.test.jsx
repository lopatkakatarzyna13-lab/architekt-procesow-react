// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkshopPanel from './WorkshopPanel'
import { createTestGateway } from '../experiments/supabase-auth/test-gateway'

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each([
  ['access denied', async () => false, async () => true, /Brak dostępu do analizy/],
  ['auth outage', async () => { throw new Error('offline') }, async () => true, /Usługa logowania jest niedostępna/],
  ['exhausted quota', async () => true, async () => false, /Osiągnięto limit/],
  ['unavailable quota', async () => true, async () => { throw new Error('offline') }, /Nie udało się przeanalizować/],
])('keeps the transcript and allows manual work on %s', async (_name, verify, reserve, message) => {
  const user = userEvent.setup()
  const analyze = vi.fn()
  const gateway = createTestGateway({ verify, reserve, analyze })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.stubGlobal('fetch', vi.fn((url, init) => gateway(new Request(new URL(url, 'http://localhost'), { ...init, headers: { ...init.headers, authorization: 'Bearer fixture' } }))))
  render(<WorkshopPanel processId="a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" dirtyRef={{ current: false }} />)
  await user.type(screen.getByLabelText('Tekst rozmowy'), 'Fikcyjne dane warsztatu')
  await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
  await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
  expect(await screen.findByText(message)).toBeTruthy()
  expect(analyze).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Tekst rozmowy').value).toBe('Fikcyjne dane warsztatu')
  await user.click(screen.getByRole('button', { name: 'Opracuj ręcznie' }))
  await user.click(screen.getByRole('button', { name: 'Dodaj: kroki' }))
  await user.type(screen.getByLabelText('Kroki — pozycja 1'), 'Ręczna weryfikacja')
  expect(screen.getByLabelText('Kroki — pozycja 1').value).toBe('Ręczna weryfikacja')
})
