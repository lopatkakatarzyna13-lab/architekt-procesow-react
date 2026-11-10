import { describe, expect, it, vi } from 'vitest'
import { requestWorkshopAnalysis } from './workshopAiClient'

describe('authenticated workshop endpoint', () => {
  it('sends the current session token and the transcript to the Edge function', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { proposal: { steps: [] } }, error: null })
    const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'fictional-token' } }, error: null }) }, functions: { invoke } }
    expect(await requestWorkshopAnalysis('fikcyjny proces', client)).toEqual({ ok: true, proposal: { steps: [] } })
    expect(invoke).toHaveBeenCalledWith('workshop-ai', { body: { transcript: 'fikcyjny proces' }, headers: { Authorization: 'Bearer fictional-token' } })
  })
  it('blocks requests without a session', async () => {
    const invoke = vi.fn()
    const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) }, functions: { invoke } }
    await expect(requestWorkshopAnalysis('tekst', client)).rejects.toThrow('AI_LOGIN_REQUIRED')
    expect(invoke).not.toHaveBeenCalled()
  })
  it('returns the server limit error for display', async () => {
    const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test' } } }) }, functions: { invoke: vi.fn().mockResolvedValue({ error: { context: new Response(JSON.stringify({ error: 'LIMIT_REACHED' })) } }) } }
    expect(await requestWorkshopAnalysis('tekst', client)).toEqual({ ok: false, error: 'LIMIT_REACHED' })
  })
})
