import { createUsageGuard, isAllowedRequest, readJsonBody } from './security.js'

const send = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(JSON.stringify(body))
}

// Local-only endpoint. Origin validation and rate limits are NOT authentication.
export function createWorkshopHandler({
  analyze,
  apiKey,
  model,
  guard = createUsageGuard(),
  allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']),
}) {
  return async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/api/analyze-workshop') {
      return send(res, 404, { error: 'NOT_FOUND' })
    }
    if (!isAllowedRequest(req, allowedOrigins)) return send(res, 403, { error: 'FORBIDDEN' })
    const admission = guard.acquire()
    if (!admission.ok) return send(res, 429, { error: admission.code })
    try {
      const input = await readJsonBody(req)
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return send(res, 400, { error: 'INVALID_REQUEST' })
      }
      const proposal = await analyze(input.transcript, { apiKey, model })
      return send(res, 200, { proposal })
    } catch (error) {
      const safe = ['MISSING_API_KEY', 'INVALID_TRANSCRIPT', 'UNVERIFIED_RESPONSE', 'INVALID_REQUEST', 'TOO_LARGE']
      const code = safe.includes(error?.message) ? error.message : 'ANALYSIS_FAILED'
      const status = code === 'TOO_LARGE' ? 413 : ['INVALID_TRANSCRIPT', 'INVALID_REQUEST'].includes(code) ? 400 : 503
      return send(res, status, { error: code })
    } finally {
      guard.release()
    }
  }
}
