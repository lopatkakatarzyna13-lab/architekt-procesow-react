import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createWorkshopHandler } from './workshopHandler.js'
import { createUsageGuard } from './security.js'

// Dependency-free SEC-04 HTTP smoke test. Uses fictitious data and a mock provider.
test('SEC-04: local HTTP security controls', async () => {
  let providerCalls = 0
  let releaseAnalysis
  let notifyStarted
  const analysisStarted = new Promise((resolve) => { notifyStarted = resolve })
  const analyze = (transcript) => {
    providerCalls += 1
    if (transcript === 'hold') {
      notifyStarted()
      return new Promise((resolve) => { releaseAnalysis = resolve })
    }
    return { steps: [], roles: [], decisions: [], questions: [] }
  }
  const server = createServer(createWorkshopHandler({
    analyze,
    apiKey: 'fictional-test-key',
    guard: createUsageGuard({ maxRequests: 3 }),
  }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}/api/analyze-workshop`
  const request = (body, origin = 'http://localhost:5173') => fetch(url, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body,
  })
  try {
    const foreign = await request('{"transcript":"test"}', 'https://untrusted.example')
    assert.equal(foreign.status, 403)
    assert.equal(providerCalls, 0)

    const valid = await request('{"transcript":"test"}')
    assert.equal(valid.status, 200)
    assert.equal(valid.headers.get('cache-control'), 'no-store')
    assert.equal(valid.headers.get('x-content-type-options'), 'nosniff')

    const pending = request('{"transcript":"hold"}')
    await analysisStarted
    const busy = await request('{"transcript":"test"}')
    assert.equal(busy.status, 429)
    assert.equal((await busy.json()).error, 'BUSY')
    releaseAnalysis({ steps: [] })
    assert.equal((await pending).status, 200)

    const invalid = await request('{broken')
    assert.equal(invalid.status, 400)
    const limit = await request('{"transcript":"test"}')
    assert.equal(limit.status, 429)
    assert.equal((await limit.json()).error, 'LIMIT_REACHED')
    assert.equal(providerCalls, 2)
  } finally {
    if (releaseAnalysis) releaseAnalysis({ steps: [] })
    await new Promise((resolve) => server.close(resolve))
  }
})
