// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
const fake = vi.hoisted(() => ({ callback: null, login: vi.fn(), logout: vi.fn(), analyze: vi.fn() }))
vi.mock('./workshopAiClient', () => ({
  workshopAiRemote: true,
  workshopAiClient: { auth: {
    onAuthStateChange: (fn) => { fake.callback = fn; return { data: { subscription: { unsubscribe: vi.fn() } } } },
    signInWithPassword: fake.login, signOut: fake.logout,
  } },
  requestWorkshopAnalysis: fake.analyze,
}))
import WorkshopPanel from './WorkshopPanel'
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })
it('requires login before sending and transfers only after review and approval', async () => {
  const user = userEvent.setup()
  fake.login.mockImplementation(async () => { fake.callback('SIGNED_IN', { access_token: 'fictional' }); return { error: null } })
  fake.analyze.mockResolvedValue({ ok: true, proposal: { steps: [{ text: 'Sprawdzenie danych', status: 'supported', evidence: 'HR sprawdza dane' }], roles: [], decisions: [], questions: [] } })
  const transfer = vi.fn(() => ({ added: 1, skipped: 0 }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<WorkshopPanel processId="a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" dirtyRef={{ current: false }} canTransferSteps onTransferSteps={transfer} />)
  await user.type(screen.getByLabelText('Tekst rozmowy'), 'HR sprawdza dane')
  await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
  expect(fake.analyze).not.toHaveBeenCalled()
  await user.type(screen.getByLabelText('E-mail do analizy AI'), 'owner@example.test')
  await user.type(screen.getByLabelText('Hasło do analizy AI'), 'fictional-pass')
  await user.click(screen.getByRole('button', { name: 'Zaloguj do analizy AI' }))
  await user.click(screen.getByRole('button', { name: 'Zapisz transkrypcję' }))
  await user.click(screen.getByRole('button', { name: 'Analizuj transkrypcję' }))
  expect(await screen.findByLabelText('Kroki — pozycja 1')).toHaveProperty('value', 'Sprawdzenie danych')
  expect(transfer).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Zapisz propozycję' }))
  await user.click(screen.getByRole('checkbox', { name: 'Wybierz krok 1 do przeniesienia' }))
  await user.click(screen.getByRole('button', { name: 'Przenieś wybrane kroki do AS-IS' }))
  expect(transfer).toHaveBeenCalledWith(['Sprawdzenie danych'])
})
