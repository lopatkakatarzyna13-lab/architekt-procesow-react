import { describe, expect, it } from 'vitest'
import { Readable } from 'node:stream'
import { createUsageGuard, isAllowedRequest, readJsonBody } from './security.js'

describe('SEC-04 local AI protection', () => {
  it('limits requests within a window and resets after expiry', () => {
    let time = 0
    const guard = createUsageGuard({ maxRequests: 2, windowMs: 1000, now: () => time })
    expect(guard.acquire()).toEqual({ ok: true })
    expect(guard.acquire()).toEqual({ ok: false, code: 'BUSY' })
    guard.release()
    expect(guard.acquire()).toEqual({ ok: true })
    guard.release()
    expect(guard.acquire()).toEqual({ ok: false, code: 'LIMIT_REACHED' })
    time = 1000
    expect(guard.acquire()).toEqual({ ok: true })
  })
  it('rejects foreign origins, invalid content types and unexpected authorization', () => {
    const origins = new Set(['http://localhost:5173'])
    const req = { method: 'POST', url: '/api/analyze-workshop', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json; charset=utf-8' } }
    expect(isAllowedRequest(req, origins)).toBe(true)
    expect(isAllowedRequest({ ...req, headers: { ...req.headers, origin: 'https://example.com' } }, origins)).toBe(false)
    expect(isAllowedRequest({ ...req, headers: { ...req.headers, 'content-type': 'application/json-malicious' } }, origins)).toBe(false)
    expect(isAllowedRequest({ ...req, headers: { ...req.headers, authorization: 'Bearer test' } }, origins)).toBe(false)
  })
  it('parses valid JSON and rejects malformed and oversized byte streams', async () => {
    expect(await readJsonBody(Readable.from([Buffer.from('{"transcript":"test"}')]))).toEqual({ transcript: 'test' })
    await expect(readJsonBody(Readable.from([Buffer.from('{bad')]))).rejects.toThrow('INVALID_REQUEST')
    await expect(readJsonBody(Readable.from([Buffer.alloc(12)]), 10)).rejects.toThrow('TOO_LARGE')
    await expect(readJsonBody(Readable.from([Buffer.from('ąąą')]), 5)).rejects.toThrow('TOO_LARGE')
  })
})
