// Test-only Edge Function. It cannot call an AI provider and is disabled by default.
const allowedOrigin = Deno.env.get('ARCHITEKT_TEST_ORIGIN')
const allowedUser = Deno.env.get('ARCHITEKT_TEST_USER_ID')
const projectUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const active = Deno.env.get('ARCHITEKT_FIXTURE_MODE') === 'true'

// Fail closed if the fixture is accidentally deployed to a hosted Supabase project.
// A test flag alone must never allow using a service-role credential on the internet.
function localUrl(value: string | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      !url.username && !url.password
  } catch { return false }
}
// Hosted Supabase sets these runtime markers; never enable this fixture there.
const hostedRuntime = ['SB_REGION', 'DENO_DEPLOYMENT_ID']
  .some((name) => Boolean(Deno.env.get(name)))
function localGateway(value: string | undefined): boolean {
  if (localUrl(value)) return true
  try {
    const url = new URL(value || '')
    // Local CLI Edge workers reach the isolated gateway through Docker DNS.
    return url.protocol === 'http:' && url.hostname === 'kong' && url.port === '8000' &&
      url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password
  } catch { return false }
}
const localOnly = !hostedRuntime && localGateway(projectUrl || undefined) && localUrl(allowedOrigin || undefined)

function reply(status: number, error: string, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors } })
}

Deno.serve(async (req: Request) => {
  if (!active || !localOnly || !allowedOrigin || !allowedUser || !projectUrl || !anonKey || !serviceKey) return reply(503, 'NOT_CONFIGURED')
  const origin = req.headers.get('origin')
  if (origin !== allowedOrigin) return reply(403, 'FORBIDDEN')
  const cors = { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Vary': 'Origin' }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
  if (req.method !== 'POST') return reply(405, 'METHOD_NOT_ALLOWED', cors)
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '')) return reply(415, 'INVALID_REQUEST', cors)
  const auth = req.headers.get('authorization') || ''
  if (!/^Bearer [^\s]+$/.test(auth)) return reply(403, 'FORBIDDEN', cors)
  try {
    const userResponse = await fetch(`${projectUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: auth }, signal: AbortSignal.timeout(5000) })
    if ([400, 401, 403].includes(userResponse.status)) return reply(403, 'FORBIDDEN', cors)
    if (!userResponse.ok) return reply(503, 'AUTH_UNAVAILABLE', cors)
    const user = await userResponse.json()
    if (user.id !== allowedUser) return reply(403, 'FORBIDDEN', cors)
  } catch { return reply(503, 'AUTH_UNAVAILABLE', cors) }
  // Bound bytes while reading, independently of Content-Length.
  const reader = req.body?.getReader()
  if (!reader) return reply(400, 'INVALID_REQUEST', cors)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) { await reader.cancel(); return reply(413, 'TOO_LARGE', cors) }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!input || Object.keys(input).length !== 1 || input.transcript !== 'HR sprawdza dane') return reply(400, 'INVALID_REQUEST', cors)
  } catch { return reply(400, 'INVALID_REQUEST', cors) }
  try {
    const reservation = await fetch(`${projectUrl}/rest/v1/rpc/architekt_fixture_reserve`, {
      method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(5000),
    })
    if (!reservation.ok) return reply(503, 'USAGE_STORAGE_UNAVAILABLE', cors)
    const result = await reservation.json()
    if (result === false) return reply(429, 'LIMIT_REACHED', cors)
    if (result !== true) return reply(503, 'USAGE_STORAGE_UNAVAILABLE', cors)
  } catch { return reply(503, 'USAGE_STORAGE_UNAVAILABLE', cors) }
  return new Response(JSON.stringify({ proposal: { steps: [{ text: 'Sprawdzenie danych', status: 'supported', evidence: 'HR sprawdza dane' }], roles: [], decisions: [], questions: [] } }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors } })
})

export {}
