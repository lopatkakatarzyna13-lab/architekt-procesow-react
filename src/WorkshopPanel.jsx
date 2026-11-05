import { useEffect, useState } from 'react'
import { loadWorkshop, MAX_TRANSCRIPT_LENGTH, saveWorkshop } from './workshop'

export default function WorkshopPanel({ processId, dirtyRef }) {
  const [initial] = useState(() => {
    try { return { ...loadWorkshop(localStorage, processId), error: '' } }
    catch { return { transcript: '', savedAt: null, error: 'Nie można odczytać transkrypcji. Istniejące dane nie zostaną nadpisane.' } }
  })
  const [transcript, setTranscript] = useState(initial.transcript)
  const [savedTranscript, setSavedTranscript] = useState(initial.transcript)
  const [message, setMessage] = useState(initial.error)
  const [savedAt, setSavedAt] = useState(initial.savedAt)
  const dirty = transcript !== savedTranscript

  useEffect(() => () => { dirtyRef.current = false }, [dirtyRef])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = () => {
    try {
      const result = saveWorkshop(localStorage, processId, transcript)
      setSavedTranscript(result.transcript)
      dirtyRef.current = false
      setSavedAt(result.savedAt)
      setMessage('Transkrypcja zapisana na tym urządzeniu.')
    } catch {
      setMessage('Nie udało się zapisać transkrypcji. Skopiuj tekst w bezpieczne miejsce i spróbuj ponownie.')
    }
  }

  return (
    <section className="workshop-panel" aria-labelledby="workshop-title">
      <h2 id="workshop-title">Transkrypcja warsztatu</h2>
      <p>Wklej rozmowę dotyczącą tego procesu. Tekst zapisuje się wyłącznie w tej przeglądarce po kliknięciu „Zapisz transkrypcję”. Uważaj na dane poufne i osoby korzystające z tego urządzenia.</p>
      <p>Automatyczna analiza i mapa BPMN będą dostępne po podłączeniu kolejnych funkcji.</p>
      <label htmlFor="workshop-transcript">Tekst rozmowy</label>
      <textarea id="workshop-transcript" rows="9" maxLength={MAX_TRANSCRIPT_LENGTH} value={transcript} disabled={Boolean(initial.error)} onChange={(event) => { setTranscript(event.target.value); dirtyRef.current = event.target.value !== savedTranscript; setMessage('') }} placeholder="Wklej transkrypcję warsztatu…" />
      <div className="workshop-actions">
        <button type="button" className="save-button" disabled={Boolean(initial.error) || !dirty} onClick={save}>Zapisz transkrypcję</button>
        <span>{transcript.length} / {MAX_TRANSCRIPT_LENGTH} znaków</span>
      </div>
      {dirty && <p role="status">Masz niezapisane zmiany. Zapisz je przed przejściem dalej.</p>}
      {message && <p role="status">{message}</p>}
      {!dirty && savedAt && !message && <p>Transkrypcja została wcześniej zapisana na tym urządzeniu.</p>}
    </section>
  )
}
