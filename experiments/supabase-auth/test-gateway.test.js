import { describe, expect, it, vi } from 'vitest'
import { createTestGateway } from './test-gateway.js'

const request = (token = 'good', body = { transcript: 'Fikcyjny proces' }) => new Request('http://localhost/api', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
describe('isolated test gateway', () => {
  it('verifies identity and quota before simulated analysis', async () => {
    const reserve = vi.fn().mockResolvedValue(true)
    const analyze = vi.fn().mockResolvedValue({ steps: [], roles: [], decisions: [], questions: [] })
    const handler = createTestGateway({ verify: async (t) => t === 'good', reserve, analyze })
    expect((await handler(request('bad'))).status).toBe(403)
    expect(reserve).not.toHaveBeenCalled()
    expect((await handler(request('good', { transcript: '' }))).status).toBe(400)
    expect(reserve).not.toHaveBeenCalled()
    expect((await handler(request())).status).toBe(200)
    expect(analyze).toHaveBeenCalledOnce()
  })
  it('blocks analysis on exhausted quota or unavailable dependencies', async () => {
    const analyze = vi.fn()
    const limit = createTestGateway({ verify: async () => true, reserve: async () => false, analyze })
    expect((await limit(request())).status).toBe(429)
    const unavailable = createTestGateway({ verify: async () => true, reserve: async () => { throw new Error('offline') }, analyze })
    expect((await unavailable(request())).status).toBe(503)
    expect(analyze).not.toHaveBeenCalled()
  })
})
