// Local development only. Do not expose this unauthenticated server publicly.
import { createServer } from 'node:http'
import process from 'node:process'
import { analyzeWorkshop } from './analyzeWorkshop.js'
import { createUsageGuard, isAllowedRequest, readJsonBody } from './security.js'

const port = 8787
const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])
const guard = createUsageGuard()
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }

createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/analyze-workshop') return send(res, 404, { error: 'NOT_FOUND' })
  if (!isAllowedRequest(req, allowedOrigins)) return send(res, 403, { error: 'FORBIDDEN' })
  const admission = guard.acquire()
  if (!admission.ok) return send(res, 429, { error: admission.code })
  try {
    const input = await readJsonBody(req)
    const proposal = await analyzeWorkshop(input.transcript, { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || undefined })
    send(res, 200, { proposal })
  } catch (error) {
    const code = ['MISSING_API_KEY', 'INVALID_TRANSCRIPT', 'UNVERIFIED_RESPONSE', 'INVALID_REQUEST', 'TOO_LARGE'].includes(error.message) ? error.message : 'ANALYSIS_FAILED'
    send(res, code === 'TOO_LARGE' ? 413 : ['INVALID_TRANSCRIPT', 'INVALID_REQUEST'].includes(code) ? 400 : 503, { error: code })
  } finally { guard.release() }
}).listen(port, '127.0.0.1', () => console.log(`Serwer warsztatu uruchomiony lokalnie na porcie ${port}.`))
