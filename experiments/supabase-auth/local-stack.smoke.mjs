// CI-only test against an ephemeral local Supabase stack. Never contact a remote project.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { createExperimentalVerifier } from './verify.js'

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = process.env
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) throw new Error('Missing ephemeral Supabase configuration')
const url = new URL(API_URL)
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
  throw new Error('Refusing to test against a non-local Supabase URL')
}
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(API_URL, SERVICE_ROLE_KEY, options)
const client = createClient(API_URL, ANON_KEY, options)
const password = 'fictional-password-for-isolated-ci-729!'
const users = []
async function makeUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user?.id) throw new Error('Could not create synthetic test user')
  users.push(data.user.id)
  return data.user.id
}
async function signIn(email) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session?.access_token || !data.session?.refresh_token) throw new Error('Synthetic sign-in failed')
  return data.session
}
try {
  const owner = await makeUser('owner@example.test')
  await makeUser('other@example.test')
  const ownerSession = await signIn('owner@example.test')
  const ownerToken = ownerSession.access_token
  const otherToken = (await signIn('other@example.test')).access_token
  const verify = createExperimentalVerifier({ url: API_URL, publishableKey: ANON_KEY, allowedUserId: owner, fetchImpl: fetch })
  assert.equal(await verify(ownerToken), true, 'allowed user')
  assert.equal(await verify(otherToken), false, 'different authenticated user')
  assert.equal(await verify(''), false, 'missing token')
  const parts = ownerToken.split('.')
  parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`
  assert.equal(await verify(parts.join('.')), false, 'modified signature')
  assert.equal(await verify('invalid-token'), false, 'invalid token')
  const claims = JSON.parse(Buffer.from(ownerToken.split('.')[1], 'base64url').toString('utf8'))
  const waitMs = claims.exp * 1000 - Date.now() + 3000
  if (!Number.isFinite(waitMs) || waitMs <= 0 || waitMs > 90_000) throw new Error('Unexpected local token expiry configuration')

  let analysisCalls = 0
  const server = createServer(async (req, res) => {
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')
    if (!match || !(await verify(match[1]))) { res.writeHead(403); return res.end() }
    analysisCalls += 1
    res.writeHead(200)
    return res.end()
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}`
    const call = (token) => fetch(endpoint, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} })
    for (const token of ['', otherToken, parts.join('.')]) assert.equal((await call(token)).status, 403)
    assert.equal(analysisCalls, 0, 'rejected requests must not invoke fake analysis')
    assert.equal((await call(ownerToken)).status, 200)
    assert.equal(analysisCalls, 1)
    await new Promise((resolve) => setTimeout(resolve, waitMs))
    assert.equal(await verify(ownerToken), false, 'expired user session')
    assert.equal((await call(ownerToken)).status, 403)
    assert.equal(analysisCalls, 1, 'expired token must not invoke fake analysis')

    const { data: refreshed, error: refreshError } = await client.auth.refreshSession({ refresh_token: ownerSession.refresh_token })
    assert.equal(refreshError, null, 'valid refresh token must renew the session')
    assert.ok(refreshed.session?.access_token && refreshed.session?.refresh_token)
    assert.equal(await verify(refreshed.session.access_token), true, 'refreshed user identity')
    assert.equal((await call(refreshed.session.access_token)).status, 200)
    assert.equal(analysisCalls, 2, 'refreshed session may invoke fake analysis')

    const { error: signOutError } = await client.auth.signOut({ scope: 'global' })
    assert.equal(signOutError, null, 'sign out must succeed')
    const { data: revoked, error: revokedError } = await client.auth.refreshSession({ refresh_token: refreshed.session.refresh_token })
    assert.ok(revokedError, 'revoked refresh token must not renew the session')
    assert.equal(revoked.session, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
  console.log('PASS: local Auth rejects expired sessions, refreshes valid sessions and revokes refresh on sign out')
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id)
}
