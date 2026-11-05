import { useEffect, useRef, useState } from 'react'
import {
  loadWorkshop, loadWorkshopReview, MAX_TRANSCRIPT_LENGTH,
  saveWorkshop, saveWorkshopReview, validateWorkshopProposal,
} from './workshop'

const categories = { steps: 'Kroki', roles: 'Role', decisions: 'Decyzje', questions: 'Pytania' }
const emptyReview = () => ({ steps: [], roles: [], decisions: [], questions: [] })

export default function WorkshopPanel({ processId, dirtyRef }) {
  const [initial] = useState(() => {
    let data
    try { data = loadWorkshop(localStorage, processId) }
    catch { return { transcript: '', savedAt: null, error: 'Nie można odczytać transkrypcji. Istniejące dane nie zostaną nadpisane.', review: null, reviewError: '' } }
    try { return { ...data, error: '', reviewError: '', ...loadWorkshopReview(localStorage, processId, data.transcript) } }
    catch { return { ...data, error: '', review: null, reviewError: 'Nie można odczytać zapisanej propozycji. Zapis nowej propozycji jest zablokowany.' } }
  })
  const [transcript, setTranscript] = useState(initial.transcript)
  const [savedTranscript, setSavedTranscript] = useState(initial.transcript)
  const [message, setMessage] = useState(initial.error)
  const [savedAt, setSavedAt] = useState(initial.savedAt)
  const [analysis, setAnalysis] = useState(initial.review)
  const [reviewDirty, setReviewDirty] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState(initial.reviewError)
  const [analyzing, setAnalyzing] = useState(false)
  const revision = useRef(0)
  const dirty = transcript !== savedTranscript

  useEffect(() => () => { dirtyRef.current = false }, [dirtyRef])
  useEffect(() => {
    if (!dirty && !reviewDirty) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, reviewDirty])

  const save = () => {
    try {
      const result = saveWorkshop(localStorage, processId, transcript)
      setSavedTranscript(result.transcript)
      dirtyRef.current = reviewDirty
      setSavedAt(result.savedAt)
      setMessage('Transkrypcja zapisana na tym urządzeniu.')
    } catch { setMessage('Nie udało się zapisać transkrypcji. Skopiuj tekst w bezpieczne miejsce i spróbuj ponownie.') }
  }

  const changeTranscript = (value) => {
    if (reviewDirty && !window.confirm('Masz niezapisaną propozycję. Zmiana transkrypcji ją usunie. Kontynuować?')) return
    setTranscript(value)
    setReviewDirty(false)
    dirtyRef.current = value !== savedTranscript
    revision.current += 1
    setAnalysis(null)
    setAnalysisMessage('')
    setMessage('')
  }

  const replaceReview = () => !reviewDirty || window.confirm('Masz niezapisaną propozycję. Czy chcesz ją zastąpić?')
  const startManual = () => {
    if (!transcript.trim()) { setAnalysisMessage('Najpierw wklej transkrypcję.'); return }
    if (!replaceReview()) return
    setAnalysis(emptyReview())
    setReviewDirty(true)
    dirtyRef.current = true
    setAnalysisMessage('Dodaj ustalenia ręcznie. Zapisz propozycję przed opuszczeniem ekranu.')
  }

  const analyze = async () => {
    if (!transcript.trim()) { setAnalysisMessage('Najpierw wklej transkrypcję.'); return }
    if (transcript.length > 20_000) { setAnalysisMessage('Do analizy można przekazać maksymalnie 20 000 znaków.'); return }
    if (!replaceReview()) return
    if (!window.confirm('Transkrypcja zostanie wysłana do OpenAI w celu analizy. Użycie API może być płatne. Czy chcesz kontynuować?')) return
    const currentRevision = revision.current
    setAnalyzing(true)
    setAnalysisMessage('')
    try {
      const response = await fetch('/api/analyze-workshop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }) })
      const result = await response.json()
      if (!response.ok) {
        if (result.error === 'MISSING_API_KEY') throw new Error('Brakuje konfiguracji klucza API po stronie serwera.')
        if (result.error === 'UNVERIFIED_RESPONSE') throw new Error('Nie udało się potwierdzić fragmentów źródłowych. Spróbuj ponownie.')
        throw new Error('Nie udało się przeanalizować transkrypcji. Sprawdź konfigurację lub spróbuj później.')
      }
      if (revision.current !== currentRevision) setAnalysisMessage('Transkrypcja lub propozycja zmieniła się podczas analizy. Uruchom analizę ponownie.')
      else if (validateWorkshopProposal(result.proposal, transcript).length) setAnalysisMessage('Odpowiedź nie przeszła kontroli źródeł. Spróbuj ponownie.')
      else { setAnalysis(result.proposal); setReviewDirty(true); dirtyRef.current = true }
    } catch (error) {
      setAnalysisMessage(error.message.includes('JSON') || error instanceof TypeError ? 'Serwer analizy jest niedostępny. Sprawdź konfigurację.' : error.message)
    } finally { setAnalyzing(false) }
  }

  const editItem = (category, index, value) => {
    revision.current += 1
    setAnalysis((current) => ({ ...current, [category]: current[category].map((item, i) => i === index ? { ...item, text: value, status: item.status === 'supported' ? 'assumption' : item.status } : item) }))
    setReviewDirty(true)
    dirtyRef.current = true
    setAnalysisMessage('')
  }
  const addItem = (category) => {
    revision.current += 1
    setAnalysis((current) => ({ ...current, [category]: [...current[category], { text: '', status: category === 'questions' ? 'question' : 'assumption', evidence: '' }] }))
    setReviewDirty(true)
    dirtyRef.current = true
  }
  const removeItem = (category, index) => {
    revision.current += 1
    setAnalysis((current) => ({ ...current, [category]: current[category].filter((_, i) => i !== index) }))
    setReviewDirty(true)
    dirtyRef.current = true
  }
  const saveReview = () => {
    if (dirty) { setAnalysisMessage('Najpierw zapisz aktualną transkrypcję.'); return }
    if (validateWorkshopProposal(analysis, transcript).length) { setAnalysisMessage('Uzupełnij wszystkie dodane pozycje i sprawdź ich źródła.'); return }
    try {
      const existing = loadWorkshopReview(localStorage, processId, transcript)
      if (existing.stale && !window.confirm('Istnieje zapisana propozycja dla wcześniejszej wersji transkrypcji. Zastąpić ją?')) return
      saveWorkshopReview(localStorage, processId, transcript, analysis, { replaceStale: existing.stale })
      setReviewDirty(false)
      dirtyRef.current = false
      setAnalysisMessage('Propozycja zapisana na tym urządzeniu.')
    } catch { setAnalysisMessage('Nie udało się zapisać propozycji. Istniejące dane nie zostały nadpisane.') }
  }

  return (
    <section className="workshop-panel" aria-labelledby="workshop-title">
      <h2 id="workshop-title">Transkrypcja warsztatu</h2>
      <p>Wklej rozmowę dotyczącą tego procesu. Tekst zapisuje się wyłącznie w tej przeglądarce po kliknięciu „Zapisz transkrypcję”. Uważaj na dane poufne i osoby korzystające z tego urządzenia.</p>
      <p>Możesz opracować ustalenia ręcznie lub przygotować propozycję z AI. Wynik wymaga Twojej weryfikacji i nie zmienia automatycznie procesu. Mapa BPMN powstanie w kolejnym etapie.</p>
      <label htmlFor="workshop-transcript">Tekst rozmowy</label>
      <textarea id="workshop-transcript" rows="9" maxLength={MAX_TRANSCRIPT_LENGTH} value={transcript} disabled={Boolean(initial.error)} onChange={(event) => changeTranscript(event.target.value)} placeholder="Wklej transkrypcję warsztatu…" />
      <div className="workshop-actions">
        <button type="button" className="save-button" disabled={Boolean(initial.error) || !dirty} onClick={save}>Zapisz transkrypcję</button>
        <button type="button" className="save-button" disabled={Boolean(initial.error) || analyzing} onClick={analyze}>{analyzing ? 'Analizuję…' : 'Analizuj transkrypcję'}</button>
        <button type="button" className="back-button" disabled={Boolean(initial.error) || analyzing} onClick={startManual}>Opracuj ręcznie</button>
        <span>{transcript.length} / {MAX_TRANSCRIPT_LENGTH} znaków</span>
      </div>
      {dirty && <p role="status">Masz niezapisane zmiany w transkrypcji.</p>}
      {message && <p role="status">{message}</p>}
      {!dirty && savedAt && !message && <p>Transkrypcja została wcześniej zapisana na tym urządzeniu.</p>}
      {initial.stale && !analysis && <p>Istnieje propozycja dla wcześniejszej wersji transkrypcji.</p>}
      {initial.reviewError && <p role="alert">{initial.reviewError}</p>}
      {analysisMessage && <p role="status">{analysisMessage}</p>}
      {analysis && <div className="workshop-results">
        <h3>Propozycja do sprawdzenia</h3>
        <p>Popraw lub dodaj ustalenia. Po edycji treści przez człowieka element jest oznaczony jako wymagający sprawdzenia. Zapisana propozycja pozostaje w tej przeglądarce.</p>
        {Object.entries(categories).map(([key, title]) => <div key={key}>
          <h4>{title}</h4>
          {analysis[key].length ? <ul>{analysis[key].map((item, index) => <li key={`${key}-${index}`}>
            <label htmlFor={`review-${key}-${index}`}>{title} — pozycja {index + 1}</label>
            <textarea id={`review-${key}-${index}`} rows="2" value={item.text} onChange={(event) => editItem(key, index, event.target.value)} />
            <small>{item.status === 'supported' ? 'Propozycja z cytatem do sprawdzenia' : item.status === 'assumption' ? 'Do sprawdzenia' : 'Pytanie'}</small>
            {item.evidence && <blockquote>Fragment rozmowy: {item.evidence}</blockquote>}
            <button type="button" className="back-button" onClick={() => removeItem(key, index)}>Usuń pozycję {index + 1} — {title.toLowerCase()}</button>
          </li>)}</ul> : <p>Brak propozycji.</p>}
          <button type="button" className="back-button" onClick={() => addItem(key)}>Dodaj: {title.toLowerCase()}</button>
        </div>)}
        <div className="workshop-actions"><button type="button" className="save-button" disabled={!reviewDirty || Boolean(initial.reviewError)} onClick={saveReview}>Zapisz propozycję</button></div>
        {reviewDirty && <p role="status">Masz niezapisaną propozycję.</p>}
      </div>}
    </section>
  )
}
