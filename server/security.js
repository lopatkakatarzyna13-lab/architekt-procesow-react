// SEC-04: local-only abuse controls. Not a substitute for authentication on a public server.
export const MAX_REQUEST_BYTES = 120_000
export function createUsageGuard({ maxRequests = 12, windowMs = 60 * 60_000, now = Date.now } = {}) {
  let started = now()
  let used = 0
  let inFlight = false
  return {
    acquire() {
      const current = now()
      if (current - started >= windowMs) { started = current; used = 0 }
      if (inFlight) return { ok: false, code: 'BUSY' }
      if (used >= maxRequests) return { ok: false, code: 'LIMIT_REACHED' }
      inFlight = true
      used += 1 // Charge attempted analyses, including provider failures.
      return { ok: true }
    },
    release() { inFlight = false },
  }
}
export function isAllowedRequest(req, origins) {
  return req.method === 'POST' &&
    req.url === '/api/analyze-workshop' &&
    origins.has(req.headers.origin) &&
    /^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '') &&
    !req.headers.authorization
}
export async function readJsonBody(req, maxBytes = MAX_REQUEST_BYTES) {
  let bytes = 0
  const chunks = []
  for await (const chunk of req) {
    bytes += chunk.byteLength
    if (bytes > maxBytes) throw new Error('TOO_LARGE')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new Error('INVALID_REQUEST') }
}
