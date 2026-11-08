// Isolated experiment only: not connected to the application or a public endpoint.
import { createClient } from '@supabase/supabase-js'

export function createExperimentalVerifier({ url, publishableKey, allowedUserId, fetchImpl }) {
  if (!url || !publishableKey || !allowedUserId || typeof fetchImpl !== 'function') throw new Error('INVALID_TEST_CONFIGURATION')
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchImpl },
  })
  return async (token) => {
    if (typeof token !== 'string' || !token.trim()) return false
    try {
      const { data, error } = await client.auth.getUser(token)
      return !error && data?.user?.id === allowedUserId
    } catch {
      return false
    }
  }
}
