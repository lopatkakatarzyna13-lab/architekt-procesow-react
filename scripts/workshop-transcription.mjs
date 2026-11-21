import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

function run(executable, args, signal) {
  return new Promise((accept, reject) => {
    const child = spawn(executable, args, { signal, windowsHide: true, stdio: ['ignore', 'ignore', 'inherit'] })
    let startError
    child.on('error', (error) => { startError = error })
    child.once('close', (code) => {
      if (signal.aborted) reject(new Error('Przerwano transkrypcję.'))
      else if (startError?.code === 'ENOENT') reject(new Error(`Nie znaleziono programu „${executable}”. Sprawdź jego ścieżkę.`))
      else if (startError || code !== 0) reject(new Error(`Program „${executable}” przerwał pracę. Sprawdź komunikaty w terminalu.`))
      else accept()
    })
  })
}

export async function requireFile(path, description) {
  const details = await stat(path).catch(() => null)
  if (!details?.isFile()) throw new Error(`Nie znaleziono pliku ${description} pod ścieżką „${path}”.`)
}

export async function recognizeWorkshopAudio(input, model, { signal, inputFormat, maxWaveBytes, progress = () => {} }) {
  const modelPath = resolve(model)
  await requireFile(modelPath, 'modelu Whisper')
  const directory = await mkdtemp(join(tmpdir(), 'architekt-transkrypcja-'))
  try {
    const wave = join(directory, 'audio.wav')
    const result = join(directory, 'transkrypcja')
    progress('Przygotowuję nagranie do rozpoznania mowy.')
    await run(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-nostdin', '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file',
      ...(inputFormat ? ['-f', inputFormat] : []),
      '-i', input, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
      ...(maxWaveBytes ? ['-fs', String(maxWaveBytes)] : []), wave,
    ], signal)
    if (maxWaveBytes && (await stat(wave)).size >= maxWaveBytes) {
      throw new Error('Nagranie jest za długie. Podziel je na krótsze części.')
    }
    progress('Rozpoznaję mowę po polsku na tym komputerze.')
    // Keep timestamp predictions for segment boundaries. Whisper's TXT output omits timestamps.
    await run(process.env.WHISPER_CLI_PATH || 'whisper-cli', [
      '-m', modelPath, '-f', wave, '-l', 'pl', '-ng', '-otxt', '-of', result,
    ], signal)
    const transcript = await readFile(`${result}.txt`, 'utf8').catch((error) => {
      if (error.code !== 'ENOENT') throw error
      return ''
    })
    if (!transcript.trim()) throw new Error('Model nie zwrócił tekstu. Sprawdź model i jakość nagrania.')
    signal.throwIfAborted()
    return transcript
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}
