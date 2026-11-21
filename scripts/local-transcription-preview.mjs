import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { MAX_TRANSCRIPT_LENGTH } from '../src/workshop.js'
import { recognizeWorkshopAudio } from './workshop-transcription.mjs'

const formats = new Map([['audio/webm', 'matroska'], ['audio/mp4', 'mov'], ['audio/ogg', 'ogg']])
const maxAudioBytes = 160 * 1024 * 1024
// Two hours at 16 kHz, mono, 16 bits, with room for the WAV header.
const maxWaveBytes = 2 * 3600 * 16_000 * 2 + 1024
const endpoint = '/api/local-workshop-transcript'

function reply(response, status, content) {
  if (response.destroyed) return
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(content))
}

export default function localTranscriptionPreview() {
  let busy = false
  return {
    name: 'local-workshop-transcription',
    configurePreviewServer(server) {
      if (server.config.preview.host !== '127.0.0.1') return
      const port = server.config.preview.port
      const host = `127.0.0.1:${port}`
      server.middlewares.use(async (request, response, next) => {
        if (request.url !== endpoint) return next()
        if (request.method !== 'POST') return reply(response, 405, { error: 'Wymagane żądanie POST.' })
        if (request.socket.localAddress !== '127.0.0.1' || request.headers.host !== host ||
            request.headers.origin !== `http://${host}` || request.headers['x-architekt-local'] !== 'transcribe') {
          return reply(response, 403, { error: 'Otwórz Architekta pod lokalnym adresem 127.0.0.1.' })
        }
        const inputFormat = formats.get(request.headers['content-type']?.split(';')[0])
        if (!inputFormat) return reply(response, 415, { error: 'Wybierz nagranie WebM, M4A lub OGG.' })
        const length = Number(request.headers['content-length'])
        if (!Number.isSafeInteger(length) || length <= 0 || length > maxAudioBytes) {
          return reply(response, 413, { error: 'Wybierz niepuste nagranie do 160 MiB. Większe nagranie podziel na części.' })
        }
        if (busy) return reply(response, 409, { error: 'Inna transkrypcja jest w toku. Spróbuj ponownie po jej zakończeniu.' })

        busy = true
        const controller = new AbortController()
        const abort = () => controller.abort()
        const timer = setTimeout(abort, 45 * 60_000)
        response.once('close', abort)
        let directory
        try {
          directory = await mkdtemp(join(tmpdir(), 'architekt-nagranie-'))
          const input = join(directory, 'nagranie')
          const model = process.env.WORKSHOP_WHISPER_MODEL || resolve('.local', 'ggml-small-q5_1.bin')
          await pipeline(request, createWriteStream(input, { flags: 'wx' }), { signal: controller.signal })
          const transcript = await recognizeWorkshopAudio(input, model, { inputFormat, maxWaveBytes, signal: controller.signal })
          if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
            return reply(response, 422, { error: `Tekst przekracza limit ${MAX_TRANSCRIPT_LENGTH} znaków. Użyj krótszego nagrania lub przygotuj TXT w terminalu.` })
          }
          reply(response, 200, { transcript })
        } catch (error) {
          reply(response, 422, { error: controller.signal.aborted
            ? 'Transkrypcja została przerwana lub przekroczyła 45 minut.'
            : error.message })
        } finally {
          clearTimeout(timer)
          response.off('close', abort)
          if (directory) await rm(directory, { recursive: true, force: true }).catch((error) => {
            console.error('Nie udało się usunąć pliku roboczego lokalnej transkrypcji.', error)
          })
          busy = false
        }
      })
    },
  }
}
