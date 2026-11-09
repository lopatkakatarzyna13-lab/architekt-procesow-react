// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkshopPanel from './WorkshopPanel'
import { createTestGateway } from '../experiments/supabase-auth/test-gateway'

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('connects workshop UI to a simulated gateway and preserves explicit approval', async () => {
  const user = userEvent.setup()
  const transfer = vi.fn(() => ({ added: 1, skipped: 0 }))
  const reserve = vi.fn(async () => true)
  const gateway = createTestGateway({
    verify: async (token) => token === 'fictional', reserve,
    analyze: async () => ({ steps: [{ text: 'Sprawdzenie danych', status: 'supported', evidence: 'HR sprawdza dane' }], roles: [], decisions: [], questions: [] }),
  })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  // Test harness adds a synthetic token; no production authentication is implemented here.
  vi.stubGlobal('fetch', vi.fn((url, init) => gateway(new Request(new URL(url, 'http://localhost'), { ...init, headers: { ...init.headers, authorization: 'Bearer fictional' } }))))
  render(<WorkshopPanel processId="a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" dirtyRef={{ current: false }} canTransferSteps onTransferSteps={transfer} />)
  await user.type(screen.getByLabelText('Tekst rozmowy'), 'HR sprawdza dane')
  await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
  await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
  expect(await screen.findByLabelText('Kroki — pozycja 1')).toHaveProperty('value', 'Sprawdzenie danych')
  expect(reserve).toHaveBeenCalledOnce()
  expect(transfer).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
  await user.click(screen.getByRole('checkbox', { name: 'Wybierz krok 1 do przeniesienia' }))
  await user.click(screen.getByRole('button', { name: 'Przenieś wybrane kroki do AS-IS' }))
  expect(transfer).toHaveBeenCalledWith(['Sprawdzenie danych'])
})
