import test from 'node:test'
import assert from 'node:assert/strict'

// Exercises the actual entry point with all network calls intercepted.
// No real AI provider or Supabase project is contacted.
const projectUrl = 'http://localhost:54321'
const origin = 'http://localhost:5173'
const legacy = { SUPABASE_ANON_KEY: 'fake-anon', SUPABASE_SERVICE_ROLE_KEY: 'fake-service' }
const modern = {
  SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'sb_publishable_fixture' }),
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_fixture' }),
}
const legacyHeaders = ['fake-anon', 'fake-service', 'Bearer fake-service']
const modernHeaders = ['sb_publishable_fixture', 'sb_secret_fixture', null]
const proposal = { steps: [], roles: [], decisions: [], questions: [] }

const cases = [
  ['legacy', legacy, legacyHeaders],
  ['modern', modern, modernHeaders],
  ['coexisting', { ...legacy, ...modern }, modernHeaders],
  ['invalid dictionary with legacy fallback', { ...legacy, SUPABASE_SECRET_KEYS: '{' }, legacyHeaders],
  ['invalid key type without fallback', { ...modern, SUPABASE_SECRET_KEYS: modern.SUPABASE_PUBLISHABLE_KEYS }, null],
]

for (const [name, keys, expected] of cases) {
  test(`Edge entry point with ${name} keys`, async () => {
    const env = { SUPABASE_URL: projectUrl, ...keys, OPENAI_API_KEY: 'fake-ai', ARCHITEKT_AI_OWNER_ID: 'owner', ARCHITEKT_AI_ORIGIN: origin, ARCHITEKT_AI_ENABLED: 'true' }
    const original = globalThis.fetch
    let handler
    const calls = []
    globalThis.Deno = { env: { get: (key) => env[key] }, serve: (fn) => { handler = fn } }
    globalThis.fetch = async (url, options) => {
      const headers = new Headers(options?.headers)
      const record = (label) => calls.push([label, headers.get('apikey'), headers.get('authorization')])
      if (url === `${projectUrl}/auth/v1/user`) {
        record('auth')
        return Response.json({ id: 'owner' })
      }
      if (url === `${projectUrl}/rest/v1/rpc/architekt_ai_acquire`) {
        record('reserve')
        return Response.json({ status: 'ACQUIRED', lease_id: '11111111-1111-4111-8111-111111111111' })
      }
      if (url === `${projectUrl}/rest/v1/rpc/architekt_ai_release`) {
        record('release')
        return Response.json(true)
      }
      if (url === 'https://api.openai.com/v1/responses') {
        record('provider')
        return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(proposal) }] }] })
      }
      throw new Error('Unexpected network request blocked')
    }
    try {
      await import(`../../supabase/functions/workshop-ai/index.ts?keys=${encodeURIComponent(name)}`)
      const request = new Request('http://localhost/', { method: 'POST', headers: { origin, authorization: 'Bearer fictional', 'content-type': 'application/json' }, body: JSON.stringify({ transcript: 'Fikcyjny proces' }) })
      const response = await handler(request)
      if (!expected) {
        assert.equal(response.status, 503)
        assert.deepEqual(await response.json(), { error: 'NOT_CONFIGURED' })
        assert.deepEqual(calls, [])
        return
      }
      const [publicKey, serverKey, serverAuthorization] = expected
      assert.equal(response.status, 200)
      assert.deepEqual(calls, [
        ['auth', publicKey, 'Bearer fictional'],
        ['reserve', serverKey, serverAuthorization],
        ['provider', null, 'Bearer fake-ai'],
        ['release', serverKey, serverAuthorization],
      ])
      assert.deepEqual((await response.json()).proposal, proposal)
    } finally { globalThis.fetch = original; delete globalThis.Deno }
  })
}
