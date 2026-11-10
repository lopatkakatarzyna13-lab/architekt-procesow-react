import test from 'node:test'
import assert from 'node:assert/strict'

// Exercises the actual entry point with all network calls intercepted.
// No real AI provider or Supabase project is contacted.
test('entry point verifies identity and reserves before simulated provider', async () => {
  const env = { SUPABASE_URL: 'http://localhost:54321', SUPABASE_ANON_KEY: 'fake-anon', SUPABASE_SERVICE_ROLE_KEY: 'fake-service', OPENAI_API_KEY: 'fake-ai', ARCHITEKT_AI_OWNER_ID: 'owner', ARCHITEKT_AI_ORIGIN: 'http://localhost:5173', ARCHITEKT_AI_ENABLED: 'true' }
  const original = globalThis.fetch
  let handler
  const calls = []
  globalThis.Deno = { env: { get: (key) => env[key] }, serve: (fn) => { handler = fn } }
  globalThis.fetch = async (url) => {
    const target = String(url)
    if (target === 'http://localhost:54321/auth/v1/user') { calls.push('auth'); return Response.json({ id: 'owner' }) }
    if (target === 'http://localhost:54321/rest/v1/rpc/architekt_ai_acquire') { calls.push('reserve'); return Response.json({ status: 'ACQUIRED', lease_id: '11111111-1111-4111-8111-111111111111' }) }
    if (target === 'http://localhost:54321/rest/v1/rpc/architekt_ai_release') { calls.push('release'); return Response.json(true) }
    if (target === 'https://api.openai.com/v1/responses') {
      calls.push('provider')
      const proposal = { steps: [], roles: [], decisions: [], questions: [] }
      return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(proposal) }] }] })
    }
    throw new Error('Unexpected network request blocked')
  }
  try {
    await import('../../supabase/functions/workshop-ai/index.ts')
    const request = () => new Request('http://localhost/', { method: 'POST', headers: { origin: env.ARCHITEKT_AI_ORIGIN, authorization: 'Bearer fictional', 'content-type': 'application/json' }, body: JSON.stringify({ transcript: 'Fikcyjny proces' }) })
    const response = await handler(request())
    assert.equal(response.status, 200)
    assert.deepEqual(calls, ['auth', 'reserve', 'provider', 'release'])
    assert.deepEqual((await response.json()).proposal, { steps: [], roles: [], decisions: [], questions: [] })
  } finally { globalThis.fetch = original; delete globalThis.Deno }
})
