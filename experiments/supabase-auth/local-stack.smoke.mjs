// CI-only test against an ephemeral local Supabase stack. Never contact a remote project.
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createServer } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { createExperimentalVerifier } from './verify.js'

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET } = process.env
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY || !JWT_SECRET) throw new Error('Missing ephemeral Supabase configuration')
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
  if (error || !data.session?.access_token) throw new Error('Synthetic sign-in failed')
  return data.session.access_token
}
function signFixtureToken(original, expiry) {
  const [header, payload] = original.split('.')
  const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))
  if (decodedHeader.alg !== 'HS256') throw new Error('Unsupported local token signing algorithm')
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  claims.exp = expiry
  const content = `${header}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`
  const signature = createHmac('sha256', JWT_SECRET).update(content).digest('base64url')
  return `${content}.${signature}`
}
try {
  const owner = await makeUser('owner@example.test')
  await makeUser('other@example.test')
  const ownerToken = await signIn('owner@example.test')
  const otherToken = await signIn('other@example.test')
  const verify = createExperimentalVerifier({ url: API_URL, publishableKey: ANON_KEY, allowedUserId: owner, fetchImpl: fetch })
  assert.equal(await verify(ownerToken), true, 'allowed user')
  assert.equal(await verify(otherToken), false, 'different authenticated user')
  assert.equal(await verify(''), false, 'missing token')
  const parts = ownerToken.split('.')
  parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`
  assert.equal(await verify(parts.join('.')), false, 'modified signature')
  assert.equal(await verify('invalid-token'), false, 'invalid token')
  const now = Math.floor(Date.now() / 1000)
  const expired = signFixtureToken(ownerToken, now - 3600)
  const unexpiredControl = signFixtureToken(ownerToken, now + 300)
  assert.equal(await verify(unexpiredControl), true, 'newly signed control token')
  assert.equal(await verify(expired), false, 'correctly signed but expired token')

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
    for (const token of ['', otherToken, parts.join('.'), expired]) assert.equal((await call(token)).status, 403)
    assert.equal(analysisCalls, 0, 'rejected requests must not invoke fake analysis')
    assert.equal((await call(ownerToken)).status, 200)
    assert.equal(analysisCalls, 1)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
  console.log('PASS: local Auth rejects expired and unauthorized sessions before simulated analysis')
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id)
}
