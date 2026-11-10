import { createClient } from '@supabase/supabase-js'

export const workshopAiRemote = import.meta.env.VITE_WORKSHOP_AI_MODE === 'supabase'
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

// Dedicated in-memory session: enabling AI does not change the existing database client.
export const workshopAiClient = workshopAiRemote && url && key
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } })
  : null

export async function requestWorkshopAnalysis(transcript, client = workshopAiClient) {
  if (!client) throw new Error('AI_NOT_CONFIGURED')
  const { data, error } = await client.auth.getSession()
  if (error || !data?.session?.access_token) throw new Error('AI_LOGIN_REQUIRED')
  const { data: result, error: invokeError } = await client.functions.invoke('workshop-ai', {
    body: { transcript }, headers: { Authorization: `Bearer ${data.session.access_token}` },
  })
  if (invokeError) {
    const body = await invokeError.context?.json?.().catch(() => null)
    return { ok: false, error: body?.error || 'ANALYSIS_FAILED' }
  }
  return { ok: true, ...result }
}
