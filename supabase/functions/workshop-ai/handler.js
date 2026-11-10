// Server-side request boundary. No client-supplied identity or limits are trusted.
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const reply = (status, error, cors = {}) => new Response(JSON.stringify({ error }), { status, headers: { ...headers, ...cors } })
export function createHandler({ enabled, origin, ownerId, verify, reserve, release, analyze }) {
  return async (req) => {
    if (!enabled || !origin || !ownerId || !verify || !reserve || !release || !analyze) return reply(503, 'NOT_CONFIGURED')
    if (req.headers.get('origin') !== origin) return reply(403, 'FORBIDDEN')
    const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Vary': 'Origin' }
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
    if (req.method !== 'POST') return reply(405, 'METHOD_NOT_ALLOWED', cors)
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '')) return reply(415, 'INVALID_REQUEST', cors)
    const bearer = req.headers.get('authorization') || ''
    if (!/^Bearer [^\s]+$/.test(bearer)) return reply(401, 'UNAUTHORIZED', cors)
    let user
    try { user = await verify(bearer) } catch { return reply(503, 'AUTH_UNAVAILABLE', cors) }
    if (!user || user !== ownerId) return reply(403, 'FORBIDDEN', cors)
    const reader = req.body?.getReader()
    if (!reader) return reply(400, 'INVALID_REQUEST', cors)
    let size = 0; const chunks = []
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 120000) { await reader.cancel(); return reply(413, 'TOO_LARGE', cors) }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      const input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).length !== 1 || typeof input.transcript !== 'string' || !input.transcript.trim() || input.transcript.length > 20000) return reply(400, 'INVALID_REQUEST', cors)
      let admission
      try { admission = await reserve() } catch { return reply(503, 'USAGE_STORAGE_UNAVAILABLE', cors) }
      if (admission?.status === 'LIMIT_REACHED') return reply(429, 'LIMIT_REACHED', cors)
      if (admission?.status === 'BUSY') return reply(429, 'BUSY', cors)
      if (admission?.status !== 'ACQUIRED' || typeof admission.lease_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(admission.lease_id)) return reply(503, 'USAGE_STORAGE_UNAVAILABLE', cors)
      let proposal, failed = false, released = false
      try { proposal = await analyze(input.transcript) } catch { failed = true }
      try { released = (await release(admission.lease_id)) === true } catch { /* fail closed until lease expires */ }
      if (!released) return reply(503, 'USAGE_STORAGE_UNAVAILABLE', cors)
      if (failed) return reply(503, 'ANALYSIS_FAILED', cors)
      return new Response(JSON.stringify({ proposal }), { status: 200, headers: { ...headers, ...cors } })
    } catch { return reply(400, 'INVALID_REQUEST', cors) }
  }
}
