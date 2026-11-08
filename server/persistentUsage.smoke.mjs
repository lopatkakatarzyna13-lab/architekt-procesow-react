import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { createWorkshopHandler } from './workshopHandler.js'
import { createPersistentUsageGuard } from './persistentUsageGuard.js'

// Runs without third-party dependencies, live AI calls, or customer data.
async function start(guard, analyze = async () => ({ steps: [] })) {
  const server = createServer(createWorkshopHandler({ guard, analyze, apiKey: 'fictional' }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { server, url: `http://127.0.0.1:${server.address().port}/api/analyze-workshop` }
}
const request = (url, content = '{"transcript":"fictional test"}') => fetch(url, {
  method: 'POST',
  headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
  body: content,
})
const close = (server) => new Promise((resolve) => server.close(resolve))

test('SEC-04 persistent quota survives recreated HTTP server', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sec04-'))
  const filePath = join(dir, 'usage.json')
  try {
    const first = await start(createPersistentUsageGuard({ filePath, maxRequests: 1 }))
    try { assert.equal((await request(first.url)).status, 200) }
    finally { await close(first.server) }
    const second = await start(createPersistentUsageGuard({ filePath, maxRequests: 1 }))
    try {
      const result = await request(second.url)
      assert.equal(result.status, 429)
      assert.equal((await result.json()).error, 'LIMIT_REACHED')
    } finally { await close(second.server) }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('SEC-04 corrupted quota rejects HTTP request', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sec04-'))
  const filePath = join(dir, 'usage.json')
  writeFileSync(filePath, '{broken')
  try {
    const instance = await start(createPersistentUsageGuard({ filePath }))
    try {
      const result = await request(instance.url)
      assert.equal(result.status, 503)
      assert.equal((await result.json()).error, 'USAGE_STORAGE_UNAVAILABLE')
    } finally { await close(instance.server) }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('SEC-04 missing initialized quota blocks HTTP before the provider is called', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sec04-'))
  const filePath = join(dir, 'usage.json')
  let calls = 0
  try {
    const first = await start(createPersistentUsageGuard({ filePath }), async () => { calls += 1; return { steps: [] } })
    try { assert.equal((await request(first.url)).status, 200) }
    finally { await close(first.server) }
    unlinkSync(filePath)
    const restarted = await start(createPersistentUsageGuard({ filePath }), async () => { calls += 1; return { steps: [] } })
    try {
      const result = await request(restarted.url)
      assert.equal(result.status, 503)
      assert.equal((await result.json()).error, 'USAGE_STORAGE_UNAVAILABLE')
      assert.equal(calls, 1)
    } finally { await close(restarted.server) }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('SEC-04 invalid JSON does not reach AI provider', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sec04-'))
  const filePath = join(dir, 'usage.json')
  let calls = 0
  try {
    const instance = await start(createPersistentUsageGuard({ filePath }), async () => {
      calls += 1
      return { steps: [] }
    })
    try {
      const result = await request(instance.url, '{invalid')
      assert.equal(result.status, 400)
      assert.equal(calls, 0)
    } finally { await close(instance.server) }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
