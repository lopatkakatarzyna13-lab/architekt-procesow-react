import { useEffect, useRef, useState } from 'react'
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
  const [analysis, setAnalysis] = useState(null)
  const [analysisMessage, setAnalysisMessage] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const revision = useRef(0)
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

  const analyze = async () => {
    if (!transcript.trim()) { setAnalysisMessage('Najpierw wklej transkrypcję.'); return }
    if (transcript.length > 20_000) { setAnalysisMessage('Do analizy można przekazać maksymalnie 20 000 znaków.'); return }
    if (!window.confirm('Transkrypcja zostanie wysłana do OpenAI w celu analizy. Użycie API może być płatne. Czy chcesz kontynuować?')) return
    const currentRevision = revision.current
    setAnalyzing(true)
    setAnalysis(null)
    setAnalysisMessage('')
    try {
      const response = await fetch('/api/analyze-workshop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }) })
      const result = await response.json()
      if (!response.ok) {
        if (result.error === 'MISSING_API_KEY') throw new Error('Brakuje konfiguracji klucza API po stronie serwera.')
        if (result.error === 'UNVERIFIED_RESPONSE') throw new Error('Nie udało się potwierdzić fragmentów źródłowych. Spróbuj ponownie.')
        throw new Error('Nie udało się przeanalizować transkrypcji. Sprawdź konfigurację lub spróbuj później.')
      }
      if (revision.current === currentRevision) setAnalysis(result.proposal)
      else setAnalysisMessage('Transkrypcja zmieniła się podczas analizy. Uruchom analizę ponownie.')
    } catch (error) {
      setAnalysisMessage(error.message.includes('JSON') || error instanceof TypeError ? 'Serwer analizy jest niedostępny. Sprawdź konfigurację.' : error.message)
    } finally { setAnalyzing(false) }
  }

  return (
    <section className="workshop-panel" aria-labelledby="workshop-title">
      <h2 id="workshop-title">Transkrypcja warsztatu</h2>
      <p>Wklej rozmowę dotyczącą tego procesu. Tekst zapisuje się wyłącznie w tej przeglądarce po kliknięciu „Zapisz transkrypcję”. Uważaj na dane poufne i osoby korzystające z tego urządzenia.</p>
      <p>Możesz przygotować propozycję kroków, ról, decyzji i pytań. Wynik wymaga Twojej weryfikacji i nie zmienia automatycznie procesu. Mapa BPMN powstanie w kolejnym etapie.</p>
      <label htmlFor="workshop-transcript">Tekst rozmowy</label>
      <textarea id="workshop-transcript" rows="9" maxLength={MAX_TRANSCRIPT_LENGTH} value={transcript} disabled={Boolean(initial.error)} onChange={(event) => { setTranscript(event.target.value); dirtyRef.current = event.target.value !== savedTranscript; revision.current += 1; setAnalysis(null); setAnalysisMessage(''); setMessage('') }} placeholder="Wklej transkrypcję warsztatu…" />
      <div className="workshop-actions">
        <button type="button" className="save-button" disabled={Boolean(initial.error) || !dirty} onClick={save}>Zapisz transkrypcję</button>
        <button type="button" className="save-button" disabled={Boolean(initial.error) || analyzing} onClick={analyze}>{analyzing ? 'Analizuję…' : 'Analizuj transkrypcję'}</button>
        <span>{transcript.length} / {MAX_TRANSCRIPT_LENGTH} znaków</span>
      </div>
      {dirty && <p role="status">Masz niezapisane zmiany. Zapisz je przed przejściem dalej.</p>}
      {message && <p role="status">{message}</p>}
      {!dirty && savedAt && !message && <p>Transkrypcja została wcześniej zapisana na tym urządzeniu.</p>}
      {analysisMessage && <p role="status">{analysisMessage}</p>}
      {analysis && <div className="workshop-results" aria-live="polite">
        <h3>Propozycja do sprawdzenia</h3>
        <p>Sprawdź każde ustalenie z uczestnikami. Wynik nie jest jeszcze zapisywany.</p>
        {Object.entries({ steps: 'Kroki', roles: 'Role', decisions: 'Decyzje', questions: 'Pytania' }).map(([key, title]) => <div key={key}>
          <h4>{title}</h4>
          {analysis[key].length ? <ul>{analysis[key].map((item, index) => <li key={`${key}-${index}`}><strong>{item.text}</strong> <small>({item.status === 'supported' ? 'wypowiedź z warsztatu' : item.status === 'assumption' ? 'założenie do sprawdzenia' : 'pytanie'})</small>{item.evidence && <blockquote>{item.evidence}</blockquote>}</li>)}</ul> : <p>Brak propozycji.</p>}
        </div>)}
      </div>}
    </section>
  )
}
