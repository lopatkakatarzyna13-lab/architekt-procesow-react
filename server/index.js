// Local development only. Do not expose this unauthenticated server publicly.
import { createServer } from 'node:http'
import process from 'node:process'
import { analyzeWorkshop } from './analyzeWorkshop.js'
import { createWorkshopHandler } from './workshopHandler.js'
import { createPersistentUsageGuard } from './persistentUsageGuard.js'

const port = 8787
const handler = createWorkshopHandler({
  analyze: analyzeWorkshop,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || undefined,
  guard: createPersistentUsageGuard(),
})
createServer(handler).listen(port, '127.0.0.1', () => {
  console.log(`Serwer warsztatu uruchomiony lokalnie na porcie ${port}.`)
})
