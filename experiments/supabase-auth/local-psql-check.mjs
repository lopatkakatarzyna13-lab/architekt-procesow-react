import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const exec = promisify(execFile)
export function localPsql(db, fixture) {
  if (!db || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(db).hostname)) throw new Error('LOCAL_DATABASE_REQUIRED')
  return async (phase, ...args) => {
    try {
      return await exec('psql', [db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', ...args])
    } catch (error) {
      const sqlState = /(?:ERROR|FATAL|PANIC):\s+([0-9A-Z]{5}):/.exec(error.stderr)?.[1]
      const reason = /not accepting connections|in recovery mode/i.test(error.stderr) ? 'database unavailable' : 'psql failed'
      throw Object.assign(new Error(`${fixture}/${phase}: ${reason} (exit ${error.code}, SQLSTATE ${sqlState ?? 'unknown'})`), { sqlState })
    }
  }
}
export async function finishBatch(requests) {
  const results = await Promise.allSettled(requests)
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) throw failed.reason
  return results.map((result) => result.value)
}
export async function checkAndClean(check, cleanup) {
  let checkError
  try { await check() } catch (error) { checkError = error }
  try { await cleanup() } catch (cleanupError) {
    if (checkError) throw new AggregateError([checkError, cleanupError], 'Database check and cleanup both failed')
    throw cleanupError
  }
  if (checkError) throw checkError
}
