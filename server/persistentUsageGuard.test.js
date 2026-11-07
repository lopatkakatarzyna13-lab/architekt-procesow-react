import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPersistentUsageGuard } from './persistentUsageGuard.js'

describe('SEC-04 persistent local AI quota', () => {
  it('keeps attempts after a simulated server restart and resets after the time window', () => {
    const dir = mkdtempSync(join(tmpdir(), 'architekt-ai-quota-'))
    const filePath = join(dir, 'usage.json')
    let time = 1000
    try {
      const options = { filePath, maxRequests: 2, windowMs: 5000, now: () => time }
      const first = createPersistentUsageGuard(options)
      expect(first.acquire()).toEqual({ ok: true })
      expect(first.acquire()).toEqual({ ok: false, code: 'BUSY' })
      first.release()
      const restarted = createPersistentUsageGuard(options)
      expect(restarted.acquire()).toEqual({ ok: true })
      restarted.release()
      const restartedAgain = createPersistentUsageGuard(options)
      expect(restartedAgain.acquire()).toEqual({ ok: false, code: 'LIMIT_REACHED' })
      time = 6000
      expect(restartedAgain.acquire()).toEqual({ ok: true })
      restartedAgain.release()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails closed on corrupt usage data and does not reset the quota', () => {
    const dir = mkdtempSync(join(tmpdir(), 'architekt-ai-corrupt-'))
    const filePath = join(dir, 'usage.json')
    try {
      writeFileSync(filePath, '{corrupt')
      const guard = createPersistentUsageGuard({ filePath })
      expect(guard.acquire()).toEqual({ ok: false, code: 'USAGE_STORAGE_UNAVAILABLE' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects invalid quota configuration', () => {
    expect(() => createPersistentUsageGuard({ maxRequests: 0 })).toThrow('INVALID_LIMIT_CONFIG')
  })
})
