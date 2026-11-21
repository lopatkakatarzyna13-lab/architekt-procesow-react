import { lstat, writeFile } from 'node:fs/promises'
import { extname, join, parse, resolve } from 'node:path'
import { MAX_TRANSCRIPT_LENGTH } from '../src/workshop.js'
import { recognizeWorkshopAudio, requireFile } from './workshop-transcription.mjs'

const usage = 'npm run workshop:transcribe -- "nagranie.webm" "ggml-small-q5_1.bin" ["transkrypcja.txt"]'

async function transcribe([audio, model, target, ...extra]) {
  if (!audio || !model || extra.length) throw new Error(usage)
  const input = resolve(audio)
  const modelPath = resolve(model)
  const { dir, name } = parse(input)
  const output = target ? resolve(target) : join(dir, `${name}.txt`)
  if (!['.webm', '.m4a', '.mp4', '.ogg', '.wav'].includes(extname(input).toLowerCase())) {
    throw new Error('Wybierz plik WebM, M4A, MP4, OGG lub WAV.')
  }
  if (extname(output).toLowerCase() !== '.txt') throw new Error('Ścieżka wyniku musi kończyć się rozszerzeniem .txt.')
  await requireFile(input, 'nagrania')
  await requireFile(modelPath, 'modelu Whisper')
  const existing = await lstat(output).catch((error) => {
    if (error.code !== 'ENOENT') throw error
    return null
  })
  if (existing) throw new Error(`Plik „${output}” już istnieje. Podaj inną ścieżkę wyniku.`)

  const controller = new AbortController()
  const interrupt = () => controller.abort()
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', interrupt)
  try {
    const transcript = await recognizeWorkshopAudio(input, modelPath, { signal: controller.signal, progress: console.log })
    await writeFile(output, transcript, { flag: 'wx' })
    console.log(`Zapisano transkrypcję w „${output}”.`)
    if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
      console.log(`Aby wczytać tekst w Architekcie, podziel go na fragmenty do ${MAX_TRANSCRIPT_LENGTH} znaków.`)
    }
  } finally {
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
  }
}

const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--help') console.log(usage)
else {
  try { await transcribe(args) }
  catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
