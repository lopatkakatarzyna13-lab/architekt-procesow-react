// CI-only test against an ephemeral local Supabase stack. Never contact a remote project.
import assert from 'node:assert/strict'
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
  if (error || !data.session?.access_token) throw new Error('Synthetic sign-in failed')
  return data.session.access_token
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
  console.log('PASS: local Supabase Auth issues sessions; configured identity accepted and unauthorized tokens denied')
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id)
}
