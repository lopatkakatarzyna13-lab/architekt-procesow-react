// Disabled unless every server-side setting is explicitly configured.
import { createHandler } from './handler.js'
import { analyzeWorkshop } from '../_shared/analyzeWorkshop.js'

const projectUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const aiKey = Deno.env.get('OPENAI_API_KEY')
const ownerId = Deno.env.get('ARCHITEKT_AI_OWNER_ID')
const origin = Deno.env.get('ARCHITEKT_AI_ORIGIN')
const enabled = Deno.env.get('ARCHITEKT_AI_ENABLED') === 'true' && Boolean(projectUrl && anonKey && serviceKey && aiKey && ownerId && origin)

Deno.serve(createHandler({
  enabled, origin, ownerId,
  verify: async (authorization: string) => {
    const response = await fetch(`${projectUrl}/auth/v1/user`, { headers: { apikey: anonKey!, Authorization: authorization }, signal: AbortSignal.timeout(5000) })
    if ([400, 401, 403].includes(response.status)) return null
    if (!response.ok) throw new Error('AUTH_UNAVAILABLE')
    return (await response.json()).id
  },
  reserve: async () => {
    const response = await fetch(`${projectUrl}/rest/v1/rpc/architekt_ai_acquire`, {
      method: 'POST', headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('USAGE_STORAGE_UNAVAILABLE')
    return await response.json()
  },
  release: async (leaseId: string) => {
    const response = await fetch(`${projectUrl}/rest/v1/rpc/architekt_ai_release`, {
      method: 'POST', headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_lease_id: leaseId }), signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('USAGE_STORAGE_UNAVAILABLE')
    return await response.json()
  },
  analyze: (transcript: string) => analyzeWorkshop(transcript, { apiKey: aiKey }),
}))
