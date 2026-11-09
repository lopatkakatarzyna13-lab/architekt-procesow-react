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
    let response
    try { response = await client.auth.getUser(token) }
    catch { throw new Error('AUTH_UNAVAILABLE') }
    if (response.error) {
      if ([400, 401, 403].includes(response.error.status)) return false
      throw new Error('AUTH_UNAVAILABLE')
    }
    return response.data?.user?.id === allowedUserId
  }
}
