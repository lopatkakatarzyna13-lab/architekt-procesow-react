import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { createWorkshopHandler } from './workshopHandler.js'
import { createUsageGuard } from './security.js'
import { createPersistentUsageGuard } from './persistentUsageGuard.js'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const servers = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))))
})

async function start(analyze, guard = createUsageGuard()) {
  const server = createServer(createWorkshopHandler({ analyze, guard, apiKey: 'not-a-real-key' }))
  servers.push(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${server.address().port}/api/analyze-workshop`
}
const request = (url, body = '{"transcript":"Fikcyjne dane"}', headers = {}) => fetch(url, {
  method: 'POST',
  headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', ...headers },
  body,
})

describe('SEC-04 HTTP integration', () => {
  it('handles valid requests without calling a real provider', async () => {
    const analyze = vi.fn(async () => ({ steps: [], roles: [], decisions: [], questions: [] }))
    const url = await start(analyze)
    const response = await request(url)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect((await response.json()).proposal.steps).toEqual([])
    expect(analyze).toHaveBeenCalledOnce()
  })
  it('rejects foreign origins before calling AI', async () => {
    const analyze = vi.fn()
    const url = await start(analyze)
    const response = await request(url, '{"transcript":"test"}', { Origin: 'https://untrusted.example' })
    expect(response.status).toBe(403)
    expect(analyze).not.toHaveBeenCalled()
  })
  it('enforces an hourly call cap at the HTTP boundary', async () => {
    const analyze = vi.fn(async () => ({ steps: [] }))
    const url = await start(analyze, createUsageGuard({ maxRequests: 1 }))
    expect((await request(url)).status).toBe(200)
    const second = await request(url)
    expect(second.status).toBe(429)
    expect((await second.json()).error).toBe('LIMIT_REACHED')
    expect(analyze).toHaveBeenCalledOnce()
  })
  it('rejects concurrent calls and releases the busy flag afterward', async () => {
    let finish
    let started
    const running = new Promise((resolve) => { started = resolve })
    const analyze = vi.fn(() => { started(); return new Promise((resolve) => { finish = resolve }) })
    const url = await start(analyze)
    const first = request(url)
    await running
    const second = await request(url)
    expect(second.status).toBe(429)
    expect((await second.json()).error).toBe('BUSY')
    finish({ steps: [] })
    expect((await first).status).toBe(200)
    expect(analyze).toHaveBeenCalledOnce()
  })
  it('keeps the HTTP quota after recreating the handler', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'architekt-http-quota-'))
    const filePath = join(dir, 'usage.json')
    try {
      const analyze = vi.fn(async () => ({ steps: [] }))
      const guard = () => createPersistentUsageGuard({ filePath, maxRequests: 1 })
      const firstUrl = await start(analyze, guard())
      expect((await request(firstUrl)).status).toBe(200)
      const secondUrl = await start(analyze, guard())
      const limit = await request(secondUrl)
      expect(limit.status).toBe(429)
      expect((await limit.json()).error).toBe('LIMIT_REACHED')
      expect(analyze).toHaveBeenCalledOnce()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  it('refuses requests with corrupted quota state without calling AI', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'architekt-http-corrupt-'))
    const filePath = join(dir, 'usage.json')
    try {
      writeFileSync(filePath, '{broken')
      const analyze = vi.fn()
      const url = await start(analyze, createPersistentUsageGuard({ filePath }))
      const response = await request(url)
      expect(response.status).toBe(503)
      expect((await response.json()).error).toBe('USAGE_STORAGE_UNAVAILABLE')
      expect(analyze).not.toHaveBeenCalled()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  it('rejects oversized and invalid JSON without invoking AI', async () => {
    const analyze = vi.fn()
    const url = await start(analyze)
    const huge = await request(url, JSON.stringify({ transcript: 'x'.repeat(120_001) }))
    expect(huge.status).toBe(413)
    const invalid = await request(url, '{invalid')
    expect(invalid.status).toBe(400)
    const nullBody = await request(url, 'null')
    expect(nullBody.status).toBe(400)
    expect(analyze).not.toHaveBeenCalled()
  })
})
