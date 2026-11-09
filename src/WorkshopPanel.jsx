import { useEffect, useRef, useState } from 'react'
import {
  deleteWorkshop, loadWorkshop, loadWorkshopReview, MAX_TRANSCRIPT_LENGTH,
  saveWorkshop, saveWorkshopReview, validateWorkshopProposal,
} from './workshop'

const categories = { steps: 'Kroki', roles: 'Role', decisions: 'Decyzje', questions: 'Pytania' }
const emptyReview = () => ({ steps: [], roles: [], decisions: [], questions: [] })
const analysisAvailable = import.meta.env.DEV || import.meta.env.VITE_WORKSHOP_AI_ENABLED === 'true'

export default function WorkshopPanel({ processId, dirtyRef, canTransferSteps = false, onTransferSteps }) {
  const [initial] = useState(() => {
    let data
    try { data = loadWorkshop(localStorage, processId) }
    catch { return { transcript: '', savedAt: null, error: 'Nie można odczytać transkrypcji. Istniejące dane nie zostaną nadpisane.', review: null, reviewError: '' } }
    try { return { ...data, error: '', reviewError: '', ...loadWorkshopReview(localStorage, processId, data.transcript) } }
    catch { return { ...data, error: '', review: null, reviewError: 'Nie można odczytać zapisanej propozycji. Zapis nowej propozycji jest zablokowany.' } }
  })
  const [readError, setReadError] = useState(initial.error)
  const [reviewLoadError, setReviewLoadError] = useState(initial.reviewError)
  const [staleReview, setStaleReview] = useState(Boolean(initial.stale))
  const [transcript, setTranscript] = useState(initial.transcript)
  const [savedTranscript, setSavedTranscript] = useState(initial.transcript)
  const [message, setMessage] = useState(initial.error)
  const [savedAt, setSavedAt] = useState(initial.savedAt)
  const [analysis, setAnalysis] = useState(initial.review)
  const [reviewDirty, setReviewDirty] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState(initial.reviewError)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedSteps, setSelectedSteps] = useState([])
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

  const clearWorkshop = () => {
    if (analyzing) return
    if (!window.confirm('Usunąć transkrypcję i propozycję tego warsztatu z tej przeglądarki? Zapisane kroki AS-IS i biblioteka procesów pozostaną bez zmian. Tej operacji nie można cofnąć.')) return
    try {
      deleteWorkshop(localStorage, processId)
      revision.current += 1
      setTranscript('')
      setSavedTranscript('')
      setSavedAt(null)
      setReadError('')
      setReviewLoadError('')
      setStaleReview(false)
      setAnalysis(null)
      setReviewDirty(false)
      setSelectedSteps([])
      dirtyRef.current = false
      setAnalysisMessage('')
      setMessage('Dane warsztatu zostały usunięte z tej przeglądarki. Kroki AS-IS i biblioteka nie zostały zmienione.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const changeTranscript = (value) => {
    if (reviewDirty && !window.confirm('Masz niezapisaną propozycję. Zmiana transkrypcji ją usunie. Kontynuować?')) return
    setTranscript(value)
    setReviewDirty(false)
    dirtyRef.current = value !== savedTranscript
    revision.current += 1
    setSelectedSteps([])
    setAnalysis(null)
    setAnalysisMessage('')
    setMessage('')
  }

  const replaceReview = () => !reviewDirty || window.confirm('Masz niezapisaną propozycję. Czy chcesz ją zastąpić?')
  const startManual = () => {
    if (!transcript.trim()) { setAnalysisMessage('Najpierw wklej transkrypcję.'); return }
    if (!replaceReview()) return
    setAnalysis(emptyReview())
    setSelectedSteps([])
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
        if (result.error === 'FORBIDDEN') throw new Error('Brak dostępu do analizy. Sprawdź logowanie i uprawnienia. Możesz kontynuować pracę ręcznie.')
        if (result.error === 'AUTH_UNAVAILABLE') throw new Error('Usługa logowania jest niedostępna. Analiza została zablokowana. Możesz kontynuować pracę ręcznie.')
        if (result.error === 'LIMIT_REACHED') throw new Error('Osiągnięto limit analiz AI. Możesz dalej opracowywać proces ręcznie i spróbować później.')
        if (result.error === 'USAGE_STORAGE_UNAVAILABLE') throw new Error('Nie można sprawdzić licznika analiz AI. Analiza została zablokowana dla ochrony kosztów. Możesz kontynuować pracę ręcznie.')
        if (result.error === 'BUSY') throw new Error('Trwa już analiza AI. Zaczekaj na jej zakończenie, zanim uruchomisz kolejną.')
        if (result.error === 'TOO_LARGE') throw new Error('Żądanie jest zbyt duże. Skróć transkrypcję i spróbuj ponownie.')
        if (result.error === 'INVALID_TRANSCRIPT' || result.error === 'INVALID_REQUEST') throw new Error('Nieprawidłowe dane analizy. Sprawdź transkrypcję i spróbuj ponownie.')
        throw new Error('Nie udało się przeanalizować transkrypcji. Sprawdź konfigurację lub spróbuj później.')
      }
      if (revision.current !== currentRevision) setAnalysisMessage('Transkrypcja lub propozycja zmieniła się podczas analizy. Uruchom analizę ponownie.')
      else if (validateWorkshopProposal(result.proposal, transcript).length) setAnalysisMessage('Odpowiedź nie przeszła kontroli źródeł. Spróbuj ponownie.')
      else { setAnalysis(result.proposal); setSelectedSteps([]); setReviewDirty(true); dirtyRef.current = true }
    } catch (error) {
      setAnalysisMessage(error.message.includes('JSON') || error instanceof TypeError ? 'Serwer analizy jest niedostępny. Sprawdź konfigurację.' : error.message)
    } finally { setAnalyzing(false) }
  }

  const editItem = (category, index, value) => {
    revision.current += 1
    if (category === 'steps') setSelectedSteps([])
    setAnalysis((current) => ({ ...current, [category]: current[category].map((item, i) => i === index ? { ...item, text: value, status: item.status === 'supported' ? 'assumption' : item.status } : item) }))
    setReviewDirty(true)
    dirtyRef.current = true
    setAnalysisMessage('')
  }
  const addItem = (category) => {
    revision.current += 1
    if (category === 'steps') setSelectedSteps([])
    setAnalysis((current) => ({ ...current, [category]: [...current[category], { text: '', status: category === 'questions' ? 'question' : 'assumption', evidence: '' }] }))
    setReviewDirty(true)
    dirtyRef.current = true
  }
  const removeItem = (category, index) => {
    revision.current += 1
    if (category === 'steps') setSelectedSteps([])
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

  const transferSteps = () => {
    if (!analysis || reviewDirty || dirty || !selectedSteps.length || !canTransferSteps || !onTransferSteps) return
    const result = onTransferSteps(analysis.steps.filter((_, index) => selectedSteps.includes(index)).map((item) => item.text))
    if (result.error) { setAnalysisMessage(result.error); return }
    setSelectedSteps([])
    setAnalysisMessage(`Dodano kroków: ${result.added}. Pominięto istniejących lub powtórzonych: ${result.skipped}. Sprawdź listę kroków poniżej i zapisz proces AS-IS.`)
  }

  return (
    <section className="workshop-panel" aria-labelledby="workshop-title">
      <h2 id="workshop-title">Transkrypcja warsztatu</h2>
      <p>Wklej rozmowę dotyczącą tego procesu. Po kliknięciu „Zapisz transkrypcję” tekst zostanie zapisany w tej przeglądarce. Uważaj na dane poufne i osoby korzystające z tego urządzenia.</p>
      {analysisAvailable && <p>Analiza AI wysyła transkrypcję do OpenAI po Twoim potwierdzeniu. Wpisanie lub zapisanie tekstu nie uruchamia analizy.</p>}
      <p>{analysisAvailable ? 'Możesz opracować ustalenia ręcznie lub przygotować propozycję z AI.' : 'Możesz opracować ustalenia ręcznie.'} Wynik wymaga Twojej weryfikacji i nie zmienia automatycznie procesu. Mapa BPMN powstanie w kolejnym etapie.</p>
      <label htmlFor="workshop-transcript">Tekst rozmowy</label>
      <textarea id="workshop-transcript" rows="9" maxLength={MAX_TRANSCRIPT_LENGTH} value={transcript} disabled={Boolean(readError)} onChange={(event) => changeTranscript(event.target.value)} placeholder="Wklej transkrypcję warsztatu…" />
      <div className="workshop-actions">
        <button type="button" className="save-button" disabled={Boolean(readError) || !dirty} onClick={save}>Zapisz transkrypcję</button>
        <button type="button" className="save-button" disabled={Boolean(readError) || analyzing || !analysisAvailable} onClick={analyze}>{analyzing ? 'Analizuję…' : 'Analizuj transkrypcję'}</button>
        <button type="button" className="back-button" disabled={Boolean(readError) || analyzing} onClick={startManual}>Opracuj ręcznie</button>
        <button type="button" className="back-button" disabled={analyzing} onClick={clearWorkshop}>Usuń dane warsztatu</button>
        <span>{transcript.length} / {MAX_TRANSCRIPT_LENGTH} znaków</span>
      </div>
      {!analysisAvailable && <p>Analiza AI nie jest jeszcze dostępna w tym podglądzie. Możesz opracować ustalenia ręcznie.</p>}
      {dirty && <p role="status">Masz niezapisane zmiany w transkrypcji.</p>}
      {message && <p role="status">{message}</p>}
      {!dirty && savedAt && !message && <p>Transkrypcja została wcześniej zapisana na tym urządzeniu.</p>}
      {staleReview && !analysis && <p>Istnieje propozycja dla wcześniejszej wersji transkrypcji.</p>}
      {reviewLoadError && <p role="alert">{reviewLoadError}</p>}
      {analysisMessage && <p role="status">{analysisMessage}</p>}
      {analysis && <div className="workshop-results">
        <h3>Propozycja do sprawdzenia</h3>
        <p>Popraw lub dodaj ustalenia. Po edycji treści przez człowieka element jest oznaczony jako wymagający sprawdzenia. Zapisana propozycja pozostaje w tej przeglądarce.</p>
        <p>Cytat pomaga odnaleźć fragment rozmowy, ale nie potwierdza poprawności propozycji. Przed przeniesieniem kroków sprawdź ich treść i kontekst.</p>
        {Object.entries(categories).map(([key, title]) => <div key={key}>
          <h4>{title}</h4>
          {analysis[key].length ? <ul>{analysis[key].map((item, index) => <li key={`${key}-${index}`}>
            {key === 'steps' && canTransferSteps && <label><input type="checkbox" checked={selectedSteps.includes(index)} onChange={(event) => setSelectedSteps((current) => event.target.checked ? [...current, index] : current.filter((itemIndex) => itemIndex !== index))} /> Wybierz krok {index + 1} do przeniesienia</label>}
            <label htmlFor={`review-${key}-${index}`}>{title} — pozycja {index + 1}</label>
            <textarea id={`review-${key}-${index}`} rows="2" value={item.text} onChange={(event) => editItem(key, index, event.target.value)} />
            <small>{item.status === 'supported' ? 'Propozycja z cytatem do sprawdzenia' : item.status === 'assumption' ? 'Do sprawdzenia' : 'Pytanie'}</small>
            {item.evidence && <blockquote>Fragment rozmowy: {item.evidence}</blockquote>}
            <button type="button" className="back-button" onClick={() => removeItem(key, index)}>Usuń pozycję {index + 1} — {title.toLowerCase()}</button>
          </li>)}</ul> : <p>Brak propozycji.</p>}
          <button type="button" className="back-button" onClick={() => addItem(key)}>Dodaj: {title.toLowerCase()}</button>
        </div>)}
        <div className="workshop-actions"><button type="button" className="save-button" disabled={!reviewDirty || Boolean(reviewLoadError)} onClick={saveReview}>Zapisz propozycję</button></div>
        {reviewDirty && <p role="status">Masz niezapisaną propozycję.</p>}
        {canTransferSteps ? <div className="workshop-actions">
          <button type="button" className="save-button" disabled={!selectedSteps.length || reviewDirty || dirty} onClick={transferSteps}>Przenieś wybrane kroki do AS-IS</button>
          <span>Najpierw zapisz propozycję. Role i pozostałe pola uzupełnij przy krokach.</span>
        </div> : <p>Przenoszenie kroków jest dostępne w trybie „Dodaj kroki samodzielnie”.</p>}
      </div>}
    </section>
  )
}
