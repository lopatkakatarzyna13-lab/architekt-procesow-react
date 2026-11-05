// Local development only. Do not expose this unauthenticated server publicly.
import { createServer } from 'node:http'
import process from 'node:process'
import { analyzeWorkshop, ANALYSIS_LIMIT } from './analyzeWorkshop.js'

const port = 8787
const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])
let busy = false
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }

createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/analyze-workshop') return send(res, 404, { error: 'NOT_FOUND' })
  if (!allowedOrigins.has(req.headers.origin) || !req.headers['content-type']?.startsWith('application/json')) return send(res, 403, { error: 'FORBIDDEN' })
  if (busy) return send(res, 429, { error: 'BUSY' })
  busy = true
  try {
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > ANALYSIS_LIMIT * 6 + 1000) return send(res, 413, { error: 'TOO_LARGE' })
    }
    let input
    try { input = JSON.parse(body) } catch { return send(res, 400, { error: 'INVALID_REQUEST' }) }
    const proposal = await analyzeWorkshop(input.transcript, { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || undefined })
    send(res, 200, { proposal })
  } catch (error) {
    const code = ['MISSING_API_KEY', 'INVALID_TRANSCRIPT', 'UNVERIFIED_RESPONSE'].includes(error.message) ? error.message : 'ANALYSIS_FAILED'
    send(res, code === 'INVALID_TRANSCRIPT' ? 400 : 503, { error: code })
  } finally { busy = false }
}).listen(port, '127.0.0.1', () => console.log(`Serwer warsztatu uruchomiony lokalnie na porcie ${port}.`))
