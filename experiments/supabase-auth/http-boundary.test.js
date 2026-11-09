import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { createExperimentalVerifier } from './verify.js'

const servers = []
async function start(handler) {
  const server = createServer(handler)
  servers.push(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${server.address().port}`
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))))
})

describe('isolated simulated authentication over local HTTP', () => {
  it('allows only the configured user and fails closed when auth is unavailable', async () => {
    let authUnavailable = false
    const authRequests = []
    const authUrl = await start((req, res) => {
      authRequests.push({ url: req.url, authorization: req.headers.authorization })
      res.setHeader('Content-Type', 'application/json')
      if (authUnavailable) { res.writeHead(503); return res.end(JSON.stringify({ message: 'unavailable' })) }
      if (req.headers.authorization === 'Bearer allowed-fixture') return res.end(JSON.stringify({ id: 'allowed-user', aud: 'authenticated' }))
      if (req.headers.authorization === 'Bearer other-fixture') return res.end(JSON.stringify({ id: 'other-user', aud: 'authenticated' }))
      res.writeHead(401)
      return res.end(JSON.stringify({ message: 'invalid token' }))
    })
    const verify = createExperimentalVerifier({ url: authUrl, publishableKey: 'fixture-key', allowedUserId: 'allowed-user', fetchImpl: fetch })
    const mockAnalysis = vi.fn(async () => ({ steps: [] }))
    const appUrl = await start(async (req, res) => {
      const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')
      if (!match) { res.writeHead(403); return res.end() }
      let allowed
      try { allowed = await verify(match[1]) } catch { res.writeHead(503); return res.end() }
      if (!allowed) { res.writeHead(403); return res.end() }
      await mockAnalysis()
      res.writeHead(200)
      return res.end()
    })
    const call = (token) => fetch(appUrl, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} })
    expect((await call()).status).toBe(403)
    expect((await call('bad-fixture')).status).toBe(403)
    expect((await call('other-fixture')).status).toBe(403)
    expect(mockAnalysis).not.toHaveBeenCalled()
    expect((await call('allowed-fixture')).status).toBe(200)
    expect(mockAnalysis).toHaveBeenCalledTimes(1)
    authUnavailable = true
    expect((await call('allowed-fixture')).status).toBe(503)
    expect(mockAnalysis).toHaveBeenCalledTimes(1)
    expect(authRequests.every(({ url }) => url === '/auth/v1/user')).toBe(true)
    expect(authRequests).toHaveLength(4)
  })
})
