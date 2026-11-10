import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from '../../supabase/functions/workshop-ai/handler.js'
const origin = 'https://app.example.test'
const token = '11111111-1111-4111-8111-111111111111'
const acquired = () => ({ status: 'ACQUIRED', lease_id: token })
const good = { enabled: true, origin, ownerId: 'owner', verify: async () => 'owner', reserve: async () => acquired(), release: async () => true, analyze: async () => ({ steps: [] }) }
function req({ auth = 'Bearer test', payload = '{"transcript":"Fikcyjny proces"}', requestOrigin = origin, type = 'application/json' } = {}) {
  return new Request('https://example.test', { method: 'POST', headers: { origin: requestOrigin, authorization: auth, 'content-type': type }, body: payload })
}
test('access, validation and quota fail closed before analysis', async () => {
  let calls = 0
  const analyze = async () => { calls++; return { steps: [] } }
  const cases = [
    [{ enabled: false }, {}, 503], [{}, { requestOrigin: 'https://other.test' }, 403], [{}, { auth: '' }, 401],
    [{ verify: async () => 'other' }, {}, 403], [{ verify: async () => { throw Error() } }, {}, 503],
    [{}, { payload: '{' }, 400], [{}, { payload: JSON.stringify({ transcript: 'x'.repeat(120001) }) }, 413],
    [{}, { payload: JSON.stringify({ transcript: 'x', user: 'owner' }) }, 400],
    [{ reserve: async () => ({ status: 'LIMIT_REACHED' }) }, {}, 429], [{ reserve: async () => ({ status: 'BUSY' }) }, {}, 429], [{ reserve: async () => { throw Error() } }, {}, 503],
    [{ reserve: async () => null }, {}, 503],
  ]
  for (const [changes, request, status] of cases) assert.equal((await createHandler({ ...good, analyze, ...changes })(req(request))).status, status)
  assert.equal(calls, 0)
})
test('authorized request reserves before analysis; provider error is generic', async () => {
  const order = []
  const handler = createHandler({ ...good, reserve: async () => { order.push('reserve'); return acquired() }, release: async (id) => { assert.equal(id, token); order.push('release'); return true }, analyze: async () => { order.push('analyze'); throw Error('secret') } })
  const response = await handler(req())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'ANALYSIS_FAILED' })
  assert.deepEqual(order, ['reserve', 'analyze', 'release'])
  const ok = await createHandler(good)(req())
  assert.equal(ok.status, 200)
  assert.deepEqual(await ok.json(), { proposal: { steps: [] } })
})

test('CORS preflight permits the Supabase SDK header only for the configured origin', async () => {
  const handler = createHandler({ enabled: true, origin: 'https://app.example.test', ownerId: 'owner', verify: async () => 'owner', reserve: async () => acquired(), release: async () => true, analyze: async () => ({}) })
  const allowed = await handler(new Request('https://edge.example.test', { method: 'OPTIONS', headers: { origin: 'https://app.example.test', 'access-control-request-headers': 'authorization, apikey, content-type, x-client-info' } }))
  assert.equal(allowed.status, 204)
  assert.match(allowed.headers.get('access-control-allow-headers'), /x-client-info/i)
  const denied = await handler(new Request('https://edge.example.test', { method: 'OPTIONS', headers: { origin: 'https://other.example.test' } }))
  assert.equal(denied.status, 403)
  assert.equal(denied.headers.get('access-control-allow-origin'), null)
})

test('release failure fails closed and does not return the proposal', async () => {
  const handler = createHandler({ ...good, release: async () => { throw Error('storage') } })
  const response = await handler(req())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'USAGE_STORAGE_UNAVAILABLE' })
})

test('client disconnect during analysis keeps the lease until the provider completes', async () => {
  let held = false
  let releaseCount = 0
  let resolveProvider
  let providerStarted
  const started = new Promise((resolve) => { providerStarted = resolve })
  const pendingProvider = new Promise((resolve) => { resolveProvider = resolve })
  const handler = createHandler({ ...good,
    reserve: async () => {
      if (held) return { status: 'BUSY' }
      held = true
      return acquired()
    },
    release: async () => { held = false; releaseCount += 1; return true },
    analyze: async () => { providerStarted(); return pendingProvider },
  })
  const controller = new AbortController()
  const firstRequest = new Request('https://example.test', { method: 'POST', signal: controller.signal, headers: { origin, authorization: 'Bearer test', 'content-type': 'application/json' }, body: '{"transcript":"Fikcyjny proces"}' })
  const first = handler(firstRequest)
  await started
  controller.abort()
  assert.equal(firstRequest.signal.aborted, true)
  assert.equal(held, true)
  const second = await handler(req())
  assert.equal(second.status, 429)
  assert.deepEqual(await second.json(), { error: 'BUSY' })
  assert.equal(releaseCount, 0)
  resolveProvider({ steps: [] })
  assert.equal((await first).status, 200)
  assert.equal(releaseCount, 1)
  assert.equal(held, false)
})
