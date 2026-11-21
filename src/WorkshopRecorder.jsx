import { useEffect, useRef, useState } from 'react'
import { deleteWorkshopRecording, finishWorkshopRecording, readWorkshopRecording, saveWorkshopRecordingChunk } from './workshopRecordings'

const formats = [['audio/webm', 'webm'], ['audio/mp4', 'm4a'], ['audio/ogg', 'ogg']]
const saveInterval = 5000
const releaseMicrophone = (stream) => stream?.getTracks().forEach((track) => track.stop())

export default function WorkshopRecorder({ processId, recordingRef }) {
  const active = useRef(null)
  const audioUrl = useRef('')
  const mounted = useRef(false)
  const [phase, setPhase] = useState('loading')
  const [recording, setRecording] = useState(null)
  const [saved, setSaved] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [error, setError] = useState('')
  const pending = ['requesting', 'recording', 'stopping'].includes(phase) ||
    Boolean(recording && !recording.local && !recording.downloaded)

  useEffect(() => {
    recordingRef.current = pending
    if (!pending) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => {
      recordingRef.current = false
      window.removeEventListener('beforeunload', warn)
    }
  }, [pending, recordingRef])

  const showRecording = (entry, local) => {
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    audioUrl.current = entry ? URL.createObjectURL(entry.blob) : ''
    setRecording(entry ? {
      id: entry.id, url: audioUrl.current, filename: entry.filename, local,
      interrupted: !entry.finished, downloaded: false,
    } : null)
  }

  useEffect(() => {
    let cancelled = false
    mounted.current = true
    readWorkshopRecording(processId).then((entry) => {
      if (!cancelled) showRecording(entry, true)
    }).catch(() => {
      if (!cancelled) setStorageAvailable(false)
    }).finally(() => {
      if (!cancelled) setPhase('idle')
    })
    return () => {
      cancelled = true
      mounted.current = false
      const capture = active.current
      active.current = null
      // Flush the final chunk when React unmounts during app navigation.
      if (capture?.recorder?.state === 'recording') capture.recorder.stop()
      releaseMicrophone(capture?.stream)
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    }
  }, [processId])

  const start = async () => {
    if (active.current) return
    const format = formats.find(([type]) => globalThis.MediaRecorder?.isTypeSupported(type))
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      setError('Ta przeglądarka nie udostępnia mikrofonu lub obsługiwanego formatu nagrania.')
      return
    }
    if (recording && (recording.local || !recording.downloaded) && !window.confirm('Rozpocząć nowe nagranie i zastąpić poprzednie?')) return
    const [mimeType, extension] = format
    const local = storageAvailable && extension === 'webm'
    const capture = { failed: false }
    active.current = capture
    setPhase('requesting')
    setSaved(false)
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (active.current !== capture) { releaseMicrophone(stream); return }
      capture.stream = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      capture.recorder = recorder
      const info = {
        processId, id: crypto.randomUUID(), mimeType: recorder.mimeType || mimeType, finished: false,
        filename: `warsztat-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extension}`,
      }
      const previousId = recording?.local ? recording.id : null
      const chunks = []
      let index = 0
      let writes = Promise.resolve()
      recorder.ondataavailable = ({ data }) => {
        if (!data.size) return
        if (!local) { chunks.push(data); return }
        const part = index++
        writes = writes.then(async () => {
          if (capture.failed) return
          await saveWorkshopRecordingChunk(info, previousId, part, data)
          if (active.current === capture) setSaved(true)
        }).catch(() => {
          capture.failed = true
          if (active.current === capture) {
            setError('Nie udało się zapisać dalszej części nagrania. Sprawdź dostępny dźwięk.')
            setPhase('stopping')
          }
          if (recorder.state === 'recording') recorder.stop()
        })
      }
      recorder.onerror = () => {
        capture.interrupted = true
        if (active.current === capture) setError('Nagrywanie zostało przerwane. Sprawdź dostępny dźwięk.')
      }
      recorder.onstop = async () => {
        releaseMicrophone(stream)
        if (active.current === capture) setPhase('stopping')
        await writes
        if (local && index && !capture.failed && !capture.interrupted && active.current === capture) {
          try {
            await finishWorkshopRecording(processId, info.id)
          } catch {
            if (active.current === capture) setError('Nie udało się potwierdzić zakończenia nagrania. Sprawdź dostępny dźwięk.')
          }
        }
        if (active.current !== capture) return
        try {
          const entry = local ? await readWorkshopRecording(processId) : chunks.length && {
            ...info, finished: !capture.interrupted, blob: new Blob(chunks, { type: info.mimeType }),
          }
          if (active.current !== capture) return
          if (entry) showRecording(entry, local)
          else if (!capture.failed) setError('Nagranie jest puste. Spróbuj ponownie.')
        } catch {
          if (active.current === capture) setError('Nie udało się odczytać nagrania. Otwórz ten proces ponownie.')
        } finally {
          if (active.current === capture) {
            active.current = null
            setPhase('idle')
          }
        }
      }
      if (local) recorder.start(saveInterval)
      else recorder.start()
      setPhase('recording')
    } catch (failure) {
      if (active.current !== capture) return
      releaseMicrophone(capture.stream)
      active.current = null
      setPhase('idle')
      setError(failure?.name === 'NotAllowedError'
        ? 'Brak zgody przeglądarki na dostęp do mikrofonu.'
        : 'Nie udało się uruchomić mikrofonu.')
    }
  }

  const stop = () => {
    const recorder = active.current?.recorder
    if (recorder?.state !== 'recording') return
    setPhase('stopping')
    recorder.stop()
  }

  const remove = async () => {
    if (!window.confirm('Usunąć zapisane nagranie z tej przeglądarki?')) return
    setPhase('deleting')
    setError('')
    try {
      await deleteWorkshopRecording(processId, recording.id)
      if (mounted.current) showRecording(null, true)
    } catch {
      if (mounted.current) setError('Nie udało się usunąć nagrania. Otwórz ten proces ponownie.')
    } finally {
      if (mounted.current) setPhase('idle')
    }
  }

  const supportsRecovery = storageAvailable && globalThis.MediaRecorder?.isTypeSupported('audio/webm')
  return (
    <section aria-labelledby="workshop-recorder-title">
      <h3 id="workshop-recorder-title">Nagranie warsztatu</h3>
      <p>{supportsRecovery
        ? 'Po uzgodnieniu nagrania z uczestnikami uruchom mikrofon. Aplikacja zapisuje dźwięk w tej przeglądarce.'
        : 'Po uzgodnieniu nagrania z uczestnikami uruchom mikrofon. W tej przeglądarce pobierz plik przed opuszczeniem ekranu.'}</p>
      <div className="workshop-actions">
        <button type="button" className="back-button" disabled={phase !== 'idle'} onClick={start}>Rozpocznij nagranie</button>
        <button type="button" className="back-button" disabled={phase !== 'recording'} onClick={stop}>Zatrzymaj nagranie</button>
      </div>
      {phase === 'recording' && <p role="status">{saved ? 'Trwa nagrywanie. Fragment zapisany.' : 'Trwa nagrywanie.'}</p>}
      {phase === 'requesting' && <p role="status">Oczekiwanie na dostęp do mikrofonu.</p>}
      {phase === 'stopping' && <p role="status">Przygotowywanie nagrania.</p>}
      {error && <p role="alert">{error}</p>}
      {recording && phase === 'idle' && <>
        {recording.local && <p>{recording.interrupted ? 'Dostępna zapisana część przerwanego nagrania.' : 'Nagranie zapisane w tej przeglądarce.'}</p>}
        <div className="workshop-actions">
          <audio controls src={recording.url} aria-label="Odsłuch nagrania warsztatu" />
          <a className="back-button" href={recording.url} download={recording.filename}
            onClick={() => setRecording((previous) => ({ ...previous, downloaded: true }))}>Pobierz nagranie</a>
          {recording.local && <button type="button" className="back-button" onClick={remove}>Usuń nagranie</button>}
        </div>
      </>}
    </section>
  )
}
