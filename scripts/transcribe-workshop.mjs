import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { copyFile, lstat, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, parse, resolve } from 'node:path'
import { MAX_TRANSCRIPT_LENGTH } from '../src/workshop.js'

const usage = 'npm run workshop:transcribe -- "nagranie.webm" "ggml-base.bin" ["transkrypcja.txt"]'

function run(executable, args, signal) {
  return new Promise((accept, reject) => {
    const child = spawn(executable, args, { signal, windowsHide: true, stdio: ['ignore', 'ignore', 'inherit'] })
    let startError
    child.on('error', (error) => { startError = error })
    child.once('close', (code) => {
      if (signal.aborted) reject(new Error('Przerwano transkrypcję.'))
      else if (startError?.code === 'ENOENT') reject(new Error(`Nie znaleziono programu „${executable}”. Sprawdź jego ścieżkę.`))
      else if (startError || code !== 0) reject(new Error(`Program „${executable}” przerwał pracę. Szczegóły są powyżej.`))
      else accept()
    })
  })
}

async function requireFile(path, description) {
  const details = await stat(path).catch(() => null)
  if (!details?.isFile()) throw new Error(`Nie znaleziono pliku ${description} pod ścieżką „${path}”.`)
}

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
  let directory
  try {
    directory = await mkdtemp(join(tmpdir(), 'architekt-transkrypcja-'))
    const wave = join(directory, 'audio.wav')
    const result = join(directory, 'transkrypcja')
    console.log('Przygotowuję nagranie do rozpoznania mowy.')
    await run(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-nostdin', '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file',
      '-i', input, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wave,
    ], controller.signal)
    console.log('Rozpoznaję mowę po polsku na tym komputerze.')
    await run(process.env.WHISPER_CLI_PATH || 'whisper-cli', [
      '-m', modelPath, '-f', wave, '-l', 'pl', '-ng', '-nt', '-otxt', '-of', result,
    ], controller.signal)
    const transcriptFile = `${result}.txt`
    const transcript = await readFile(transcriptFile, 'utf8').catch((error) => {
      if (error.code !== 'ENOENT') throw error
      return ''
    })
    if (!transcript.trim()) throw new Error('Model nie zwrócił tekstu. Sprawdź model i jakość nagrania.')
    if (controller.signal.aborted) throw new Error('Przerwano transkrypcję.')
    await copyFile(transcriptFile, output, constants.COPYFILE_EXCL)
    console.log(`Zapisano transkrypcję w „${output}”.`)
    if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
      console.log(`Aby wczytać tekst w Architekcie, podziel go na fragmenty do ${MAX_TRANSCRIPT_LENGTH} znaków.`)
    }
  } finally {
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
    if (directory) await rm(directory, { force: true, recursive: true })
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
