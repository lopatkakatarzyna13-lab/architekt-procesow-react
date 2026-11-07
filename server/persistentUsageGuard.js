// Local single-process usage accounting. Not a public API rate limiter or a provider billing cap.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export function createPersistentUsageGuard({
  filePath = resolve(process.cwd(), '.local', 'ai-usage.json'),
  maxRequests = 12,
  windowMs = 60 * 60_000,
  now = Date.now,
} = {}) {
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new Error('INVALID_LIMIT_CONFIG')
  }
  let inFlight = false
  const path = resolve(filePath)
  const tmpPath = `${path}.${process.pid}.tmp`
  return {
    acquire() {
      if (inFlight) return { ok: false, code: 'BUSY' }
      try {
        const current = now()
        if (!Number.isSafeInteger(current) || current < 0) return { ok: false, code: 'USAGE_STORAGE_UNAVAILABLE' }
        let state
        try {
          state = JSON.parse(readFileSync(path, 'utf8'))
        } catch (error) {
          if (error.code !== 'ENOENT') return { ok: false, code: 'USAGE_STORAGE_UNAVAILABLE' }
          state = { version: 1, started: current, used: 0 }
        }
        if (state?.version !== 1 || !Number.isSafeInteger(state.started) || !Number.isSafeInteger(state.used) ||
          state.used < 0 || state.started < 0 || state.started > current) {
          return { ok: false, code: 'USAGE_STORAGE_UNAVAILABLE' }
        }
        if (current - state.started >= windowMs) state = { version: 1, started: current, used: 0 }
        if (state.used >= maxRequests) return { ok: false, code: 'LIMIT_REACHED' }
        const updated = { ...state, used: state.used + 1 }
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
        writeFileSync(tmpPath, JSON.stringify(updated), { mode: 0o600 })
        renameSync(tmpPath, path)
        inFlight = true
        return { ok: true }
      } catch {
        return { ok: false, code: 'USAGE_STORAGE_UNAVAILABLE' }
      }
    },
    release() { inFlight = false },
  }
}
