// Test-only gateway. It is not a deployable endpoint or production security control.
export function createTestGateway({ verify, reserve, analyze }) {
  if (![verify, reserve, analyze].every((fn) => typeof fn === 'function')) throw new Error('Missing test dependency')
  return async (request) => {
    if (request.method !== 'POST') return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
    const match = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') || '')
    try {
      if (!match || !(await verify(match[1]))) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
      const input = await request.json().catch(() => null)
      if (typeof input?.transcript !== 'string' || !input.transcript.trim() || input.transcript.length > 20000) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
      if (!(await reserve())) return Response.json({ error: 'LIMIT_REACHED' }, { status: 429 })
      return Response.json({ proposal: await analyze(input.transcript) })
    } catch {
      return Response.json({ error: 'UNAVAILABLE' }, { status: 503 })
    }
  }
}
