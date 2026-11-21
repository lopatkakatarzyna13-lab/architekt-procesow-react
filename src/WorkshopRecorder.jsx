import { useEffect, useRef, useState } from 'react'

const formats = [['audio/webm', 'webm'], ['audio/mp4', 'm4a'], ['audio/ogg', 'ogg']]
const releaseMicrophone = (stream) => stream?.getTracks().forEach((track) => track.stop())

export default function WorkshopRecorder({ recordingRef }) {
  const active = useRef(null)
  const audioUrl = useRef('')
  const [phase, setPhase] = useState('idle')
  const [recording, setRecording] = useState(null)
  const [error, setError] = useState('')
  const pending = phase !== 'idle' || Boolean(recording && !recording.downloaded)

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

  useEffect(() => () => {
    const capture = active.current
    active.current = null
    if (capture?.recorder?.state === 'recording') capture.recorder.stop()
    releaseMicrophone(capture?.stream)
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
  }, [])

  const start = async () => {
    if (active.current) return
    const format = formats.find(([type]) => globalThis.MediaRecorder?.isTypeSupported(type))
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      setError('Ta przeglądarka nie udostępnia mikrofonu lub obsługiwanego formatu nagrania.')
      return
    }
    if (recording && !recording.downloaded && !window.confirm('Rozpocząć nowe nagranie i zastąpić poprzednie?')) return
    const [mimeType, extension] = format
    const capture = {}
    active.current = capture
    setPhase('requesting')
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (active.current !== capture) { releaseMicrophone(stream); return }
      capture.stream = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      capture.recorder = recorder
      const chunks = []
      recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data) }
      recorder.onerror = () => { if (active.current === capture) setError('Nagrywanie zostało przerwane. Sprawdź dostępny fragment.') }
      recorder.onstop = () => {
        releaseMicrophone(stream)
        if (active.current !== capture) return
        active.current = null
        setPhase('idle')
        if (!chunks.length) { setError('Nagranie jest puste. Spróbuj ponownie.'); return }
        if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
        audioUrl.current = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || mimeType }))
        const time = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
        setRecording({ url: audioUrl.current, filename: `warsztat-${time}.${extension}`, downloaded: false })
      }
      recorder.start()
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

  return (
    <section aria-labelledby="workshop-recorder-title">
      <h3 id="workshop-recorder-title">Nagranie warsztatu</h3>
      <p>Po uzgodnieniu nagrania z uczestnikami uruchom mikrofon. Pobierz plik przed opuszczeniem tego ekranu.</p>
      <div className="workshop-actions">
        <button type="button" className="back-button" disabled={phase !== 'idle'} onClick={start}>Rozpocznij nagranie</button>
        <button type="button" className="back-button" disabled={phase !== 'recording'} onClick={stop}>Zatrzymaj nagranie</button>
      </div>
      {phase !== 'idle' && <p role="status">{phase === 'recording' ? 'Trwa nagrywanie.' : phase === 'requesting' ? 'Oczekiwanie na dostęp do mikrofonu.' : 'Przygotowywanie nagrania.'}</p>}
      {error && <p role="alert">{error}</p>}
      {recording && phase === 'idle' && <div className="workshop-actions">
        <audio controls src={recording.url} aria-label="Odsłuch nagrania warsztatu" />
        <a className="back-button" href={recording.url} download={recording.filename}
          onClick={() => setRecording((previous) => ({ ...previous, downloaded: true }))}>Pobierz nagranie</a>
      </div>}
    </section>
  )
}
