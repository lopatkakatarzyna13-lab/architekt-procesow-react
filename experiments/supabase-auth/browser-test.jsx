// Local CI harness only. Not an application authentication implementation.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import App from '../../src/App.jsx'
import '../../src/index.css'

const url = import.meta.env.VITE_TEST_AUTH_URL
const key = import.meta.env.VITE_TEST_ANON_KEY
if (!import.meta.env.DEV || !url || !key || !['localhost', '127.0.0.1'].includes(new URL(url).hostname) || !['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('LOCAL_TEST_ONLY')
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } })
const realFetch = window.fetch.bind(window)
window.fetch = async (input, init) => {
  if (input !== '/api/analyze-workshop') return realFetch(input, init)
  const { data } = await client.auth.getSession()
  const headers = new Headers(init?.headers)
  if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`)
  return realFetch(input, { ...init, headers })
}

function LocalTestApp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  async function login(event) {
    event.preventDefault()
    try {
      const { error } = await client.auth.signInWithPassword({ email, password })
      setMessage(error ? 'Logowanie niedostępne lub niepoprawne' : 'Zalogowano testowo')
    } catch { setMessage('Logowanie niedostępne lub niepoprawne') }
  }
  async function logout() { await client.auth.signOut(); setMessage('Wylogowano') }
  return <><aside><strong>Wyłącznie odizolowany test, fikcyjne dane</strong><form onSubmit={login}>
    <label>E-mail testowy<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>Hasło testowe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <button type="submit">Zaloguj testowo</button><button type="button" onClick={logout}>Wyloguj testowo</button>
  </form><p role="status">{message}</p></aside><App /></>
}
createRoot(document.getElementById('root')).render(<LocalTestApp />)
