import { describe, expect, it, vi } from 'vitest'
import { createExperimentalVerifier } from './verify.js'

const options = { url: 'https://synthetic.invalid', publishableKey: 'fictional-public-key', allowedUserId: 'allowed-user' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('isolated Supabase identity experiment', () => {
  it('accepts the expected user only after a simulated server verification', async () => {
    const fetchImpl = vi.fn(async () => json({ id: 'allowed-user', aud: 'authenticated' }))
    const verify = createExperimentalVerifier({ ...options, fetchImpl })
    expect(await verify('fictional-token')).toBe(true)
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe('https://synthetic.invalid/auth/v1/user')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer fictional-token')
  })
  it('rejects a different verified user and does not accept a missing token', async () => {
    const fetchImpl = vi.fn(async () => json({ id: 'other-user', aud: 'authenticated' }))
    const verify = createExperimentalVerifier({ ...options, fetchImpl })
    expect(await verify('fictional-token')).toBe(false)
    expect(await verify('')).toBe(false)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
  it('rejects invalid tokens but reports auth outages without granting access', async () => {
    const denied = createExperimentalVerifier({ ...options, fetchImpl: async () => json({ message: 'invalid token' }, 401) })
    expect(await denied('fictional-token')).toBe(false)
    const offline = createExperimentalVerifier({ ...options, fetchImpl: async () => { throw new Error('offline') } })
    await expect(offline('fictional-token')).rejects.toThrow('AUTH_UNAVAILABLE')
    const failed = createExperimentalVerifier({ ...options, fetchImpl: async () => json({ message: 'unavailable' }, 503) })
    await expect(failed('fictional-token')).rejects.toThrow('AUTH_UNAVAILABLE')
  })
  it('refuses incomplete configuration', () => {
    expect(() => createExperimentalVerifier({ ...options, allowedUserId: '', fetchImpl: vi.fn() })).toThrow('INVALID_TEST_CONFIGURATION')
  })
})
