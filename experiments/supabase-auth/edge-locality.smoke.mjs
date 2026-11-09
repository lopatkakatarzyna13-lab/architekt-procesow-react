import test from 'node:test'
import assert from 'node:assert/strict'

const base = {
  ARCHITEKT_FIXTURE_MODE: 'true',
  ARCHITEKT_TEST_ORIGIN: 'http://127.0.0.1:5173',
  ARCHITEKT_TEST_USER_ID: 'fictional-user',
  SUPABASE_URL: 'http://kong:8000',
  SUPABASE_ANON_KEY: 'fake-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-service',
}
const scenarios = [
  ['local Docker gateway', {}, 403],
  ['loopback gateway', { SUPABASE_URL: 'http://127.0.0.1:54321' }, 403],
  ['remote project', { SUPABASE_URL: 'https://example.supabase.co' }, 503],
  ['gateway lookalike', { SUPABASE_URL: 'http://kong.example:8000' }, 503],
  ['gateway different port', { SUPABASE_URL: 'http://kong:9000' }, 503],
  ['nonlocal origin', { ARCHITEKT_TEST_ORIGIN: 'https://example.com' }, 503],
  ['disabled flag', { ARCHITEKT_FIXTURE_MODE: 'false' }, 503],
  ['hosted region', { SB_REGION: 'eu-central-1' }, 503],
  ['hosted execution', { SB_EXECUTION_ID: 'fake' }, 503],
  ['hosted deployment', { DENO_DEPLOYMENT_ID: 'fake' }, 503],
]
test('fixture rejects hosted and nonlocal configurations before any external call', async () => {
  let calls = 0
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => { calls++; throw new Error('Unexpected outbound request') }
    for (const [index, [name, overrides, expected]] of scenarios.entries()) {
      const env = { ...base, ...overrides }
      let handler
      globalThis.Deno = { env: { get: (key) => env[key] }, serve: (fn) => { handler = fn } }
      await import(`./workshop-fixture/index.ts?case=${index}`)
      const response = await handler(new Request('http://127.0.0.1/', {
        method: 'POST', headers: { origin: env.ARCHITEKT_TEST_ORIGIN, 'content-type': 'application/json' }, body: '{}',
      }))
      assert.equal(response.status, expected, name)
    }
    assert.equal(calls, 0, 'config and missing token are rejected before external calls')
  } finally {
    globalThis.fetch = originalFetch
    delete globalThis.Deno
  }
})
