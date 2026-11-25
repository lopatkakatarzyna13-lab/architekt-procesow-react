import { useEffect, useRef, useState } from 'react'
import WorkshopDocuments from './WorkshopDocuments.jsx'
import WorkshopDecision from './WorkshopDecision.jsx'
import { requestWorkshopAnalysis, workshopAiClient, workshopAiRemote } from './workshopAiClient'
import { loadCurrentProcessId } from './processIdentity'
import { proposeLocalWorkshop } from './localWorkshopProposal'
import WorkshopRecorder from './WorkshopRecorder'
import {
  deleteWorkshop, formatOpenWorkshopQuestions, getLocalWorkshopDate, loadWorkshop, loadWorkshopReview, MAX_TRANSCRIPT_LENGTH,
  MAX_WORKSHOP_ANSWER_LENGTH, MAX_WORKSHOP_ASSIGNEE_LENGTH,
  loadWorkshopDraft, saveWorkshopDraft, saveWorkshop, saveWorkshopReview, validateWorkshopProposal, validateWorkshopReview,
} from './workshop'

const categories = { steps: 'Kroki', roles: 'Role', systems: 'Systemy', decisions: 'Decyzje', exceptions: 'Wyjątki', questions: 'Pytania' }
const emptyReview = () => ({ steps: [], roles: [], systems: [], decisions: [], exceptions: [], questions: [] })
const completeReview = (review) => review ? { ...emptyReview(), ...review } : null
// Only the user can review a suggestion or record an answer.
const unreviewedProposal = (proposal) => Object.fromEntries(Object.keys(categories).map((key) =>
  [key, (proposal[key] ?? []).map(({ text, status, evidence }) => ({ text, status, evidence, reviewed: false }))]))
const analysisAvailable = import.meta.env.DEV || (workshopAiRemote && import.meta.env.VITE_WORKSHOP_AI_ENABLED === 'true')
const localWorkshop = import.meta.env.MODE === 'workshop-local'

export default function WorkshopPanel({ processId, processName, dirtyRef, recordingRef, autosaveDraft = false, canTransferSteps = false, mapSteps, onApplyDecision, onApplyDocument, onPrepareHandoff, onTransferSteps, onUseFinding, onDecisionSourceChange }) {
  const [initial] = useState(() => {
    let data
    try { data = loadWorkshop(localStorage, processId) }
    catch { return { transcript: '', savedAt: null, error: 'Nie można odczytać transkrypcji. Istniejące dane nie zostaną nadpisane.', review: null, reviewError: '' } }
    try { return { ...data, error: '', reviewError: '', ...loadWorkshopReview(localStorage, processId, data.transcript) } }
    catch { return { ...data, error: '', review: null, reviewError: 'Nie można odczytać zapisanej propozycji. Zapis nowej propozycji jest zablokowany.' } }
  })
  const [draft] = useState(() => {
    if (!autosaveDraft || initial.error || initial.reviewError) return null
    try { return loadWorkshopDraft(localStorage, processId, initial.transcript) }
    catch { return null }
  })
  const [aiSession, setAiSession] = useState(null)
  const [aiEmail, setAiEmail] = useState('')
  const [aiPassword, setAiPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [readError, setReadError] = useState(initial.error)
  const [reviewLoadError, setReviewLoadError] = useState(initial.reviewError)
  const [staleReview, setStaleReview] = useState(Boolean(initial.stale))
  const [transcript, setTranscript] = useState(draft?.transcript ?? initial.transcript)
  const [savedTranscript, setSavedTranscript] = useState(initial.transcript)
  const [message, setMessage] = useState(initial.error)
  const [savedAt, setSavedAt] = useState(initial.savedAt)
  const [analysis, setAnalysis] = useState(() => completeReview(draft ? draft.review : initial.review))
  const [manualReview, setManualReview] = useState(draft?.manual ?? Boolean(initial.manual))
  const [reviewDirty, setReviewDirty] = useState(draft?.reviewDirty ?? false)
  const [draftError, setDraftError] = useState('')
  const [analysisMessage, setAnalysisMessage] = useState(initial.reviewError)
  const [storageUncertain, setStorageUncertain] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedSteps, setSelectedSteps] = useState([])
  const [onlyOpenQuestions, setOnlyOpenQuestions] = useState(false)
  const openQuestionFilter = useRef(null)
  const revision = useRef(0)
  const activeAnalysis = useRef(null)
  const transcriptImport = useRef(0)
  const localTranscription = useRef(null)
  const [transcribing, setTranscribing] = useState(false)
  const dirty = transcript !== savedTranscript

  useEffect(() => {
    if (!workshopAiClient || !analysisAvailable) return undefined
    const { data } = workshopAiClient.auth.onAuthStateChange((_event, session) => setAiSession(session))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!onDecisionSourceChange) return
    const eligible = canTransferSteps && analysis && !dirty && !reviewDirty && !analyzing && !storageUncertain
    const decisions = eligible
      ? analysis.decisions.filter((item) => item.reviewed === true).map((item) => item.text.trim().replace(/\s+/g, ' '))
      : []
    onDecisionSourceChange({ processId, decisions: [...new Set(decisions)] })
  }, [analysis, analyzing, canTransferSteps, dirty, onDecisionSourceChange, processId, reviewDirty, storageUncertain])

  useEffect(() => () => { dirtyRef.current = false }, [dirtyRef])
  useEffect(() => {
    if (!autosaveDraft || readError || reviewLoadError || storageUncertain) return
    dirtyRef.current = dirty || reviewDirty
    let error = ''
    try {
      if (loadCurrentProcessId(localStorage)?.toLowerCase() !== processId.toLowerCase()) return
      const draft = dirty || reviewDirty
        ? { transcript: dirty ? transcript : null, review: analysis, manual: manualReview, reviewDirty }
        : null
      saveWorkshopDraft(localStorage, processId, savedTranscript, draft)
    } catch {
      error = 'Nie udało się zapisać szkicu warsztatu w tej przeglądarce.'
    }
    let active = true
    queueMicrotask(() => {
      if (active) setDraftError(error)
    })
    return () => { active = false }
  }, [analysis, autosaveDraft, dirty, dirtyRef, manualReview, processId, readError, reviewDirty, reviewLoadError, savedTranscript, storageUncertain, transcript])
  useEffect(() => () => {
    activeAnalysis.current?.abort()
    activeAnalysis.current = null
    localTranscription.current?.abort()
    localTranscription.current = null
    transcriptImport.current += 1
  }, [])
  const signInAi = async (event) => {
    event.preventDefault()
    if (!workshopAiClient || authBusy) return
    setAuthBusy(true); setAuthMessage('')
    try {
      const { error } = await workshopAiClient.auth.signInWithPassword({ email: aiEmail.trim(), password: aiPassword })
      setAiPassword('')
      if (error) setAuthMessage('Nie udało się zalogować. Sprawdź dane lub spróbuj ponownie.')
    } catch { setAiPassword(''); setAuthMessage('Usługa logowania jest niedostępna.') }
    finally { setAuthBusy(false) }
  }
  const signOutAi = async () => {
    setAuthBusy(true)
    try { const { error } = await workshopAiClient.auth.signOut(); if (error) throw error; setAiSession(null); setAuthMessage('Wylogowano z analizy AI.') }
    catch { setAuthMessage('Nie udało się wylogować. Spróbuj ponownie.') }
    finally { setAuthBusy(false) }
  }
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
    transcriptImport.current += 1
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
      setManualReview(false)
      setReviewDirty(false)
      setSelectedSteps([])
      dirtyRef.current = false
      setAnalysisMessage('')
      setMessage('Dane warsztatu zostały usunięte z tej przeglądarki. Kroki AS-IS i biblioteka nie zostały zmienione.')
    } catch (error) {
      if (error.code === 'DELETE_ROLLBACK_FAILED') setStorageUncertain(true)
      setMessage(error.message)
    }
  }

  const changeTranscript = (value, confirmed = false) => {
    if (!confirmed && !manualReview && reviewDirty && !window.confirm('Masz niezapisaną propozycję. Zmiana transkrypcji ją usunie. Kontynuować?')) return
    setTranscript(value)
    revision.current += 1
    setMessage('')
    if (manualReview) {
      dirtyRef.current = value !== savedTranscript || reviewDirty
      return
    }
    setReviewDirty(false)
    dirtyRef.current = value !== savedTranscript
    setSelectedSteps([])
    setAnalysis(null)
    setAnalysisMessage('')
  }

  const importTranscript = async (event) => {
    const [file] = event.target.files
    event.target.value = ''
    if (!file || readError || analyzing) return
    const request = ++transcriptImport.current
    const startRevision = revision.current
    const isCurrent = () => request === transcriptImport.current && startRevision === revision.current
    if (!/\.txt$/i.test(file.name)) {
      setMessage('Wybierz plik TXT zapisany w UTF-8.')
      return
    }
    const limitMessage = `Plik przekracza limit ${MAX_TRANSCRIPT_LENGTH} znaków. Wybierz krótszy fragment rozmowy.`
    if (file.size > 4 * MAX_TRANSCRIPT_LENGTH + 3) {
      setMessage(limitMessage)
      return
    }
    let value
    try { value = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/\r\n?/g, '\n') }
    catch {
      if (isCurrent()) setMessage('Nie udało się odczytać pliku TXT w UTF-8.')
      return
    }
    if (!isCurrent()) return
    if (value.includes('\0') || !value.trim()) {
      setMessage('Wybierz plik TXT w UTF-8 zawierający tekst rozmowy.')
      return
    }
    if (value.length > MAX_TRANSCRIPT_LENGTH) {
      setMessage(limitMessage)
      return
    }
    applyImportedTranscript(value, 'plik')
  }

  const applyImportedTranscript = (value, source) => {
    if (value === transcript) return
    const replacesProposal = !manualReview && analysis
    if (transcript || savedTranscript || replacesProposal) {
      const action = source === 'plik' ? 'Wczytać plik w miejsce bieżącej transkrypcji?' : 'Wczytać wynik rozpoznawania w miejsce bieżącej transkrypcji?'
      if (!window.confirm(replacesProposal ? action + ' Propozycja powiązana z poprzednim tekstem zniknie z edytora.' : action)) return
    }
    changeTranscript(value, true)
    setMessage(source === 'plik'
      ? 'Wczytano tekst z pliku. Sprawdź go i wybierz „Zapisz transkrypcję”.'
      : 'Utworzono lokalną transkrypcję. Sprawdź ją i wybierz „Zapisz transkrypcję”.')
  }

  const transcribeRecording = async (audio) => {
    if (localTranscription.current || readError || analyzing) return
    const controller = new AbortController()
    const request = ++transcriptImport.current
    const startRevision = revision.current
    const isCurrent = () => request === transcriptImport.current && startRevision === revision.current && !controller.signal.aborted
    localTranscription.current = controller
    setTranscribing(true)
    setMessage('')
    try {
      const response = await fetch('/api/local-workshop-transcript', {
        method: 'POST', headers: { 'X-Architekt-Local': 'transcribe' }, body: audio, signal: controller.signal,
      })
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Lokalna transkrypcja jest niedostępna. Uruchom aktualną wersję przez npm run workshop:local.')
      }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Nie udało się utworzyć lokalnej transkrypcji.')
      const value = result.transcript?.replace(/\r\n?/g, '\n')
      if (!value?.trim() || value.includes('\0') || value.length > MAX_TRANSCRIPT_LENGTH) {
        throw new Error('Rozpoznany tekst jest pusty lub przekracza limit transkrypcji.')
      }
      if (isCurrent()) applyImportedTranscript(value, 'nagranie')
      else if (!controller.signal.aborted && localTranscription.current === controller) {
        setMessage('Tekst warsztatu zmienił się w trakcie rozpoznawania. Utwórz transkrypcję ponownie, aby ją wczytać.')
      }
    } catch (error) {
      if (isCurrent()) setMessage(error.message)
    } finally {
      if (localTranscription.current === controller) {
        localTranscription.current = null
        setTranscribing(false)
        if (controller.signal.aborted) setMessage('Anulowano lokalną transkrypcję.')
      }
    }
  }

  const replaceReview = (confirmSaved = false) => {
    if (analysis?.questions.some(({ answer, assignee, dueDate }) => answer?.trim() || assignee?.trim() || dueDate)) {
      return window.confirm('Nowa propozycja zastąpi bieżące ustalenia, w tym odpowiedzi na pytania, przypisane osoby i terminy. Kontynuować?')
    }
    if (manualReview && analysis) return window.confirm('Zastąpić ustalenia zapisane ręcznie?')
    if (confirmSaved && analysis && !reviewDirty) return window.confirm('Zastąpić bieżącą propozycję warsztatu nowym szkicem AS-IS?')
    return !reviewDirty || window.confirm('Masz niezapisaną propozycję. Czy chcesz ją zastąpić?')
  }
  const startManual = () => {
    if (!replaceReview()) return
    transcriptImport.current += 1
    setManualReview(!transcript.trim())
    setAnalysis(emptyReview())
    setSelectedSteps([])
    setReviewDirty(true)
    dirtyRef.current = true
    setAnalysisMessage('Dodaj ustalenia ręcznie. Zapisz propozycję przed opuszczeniem ekranu.')
  }

  const prepareLocalProposal = () => {
    if (dirty || !savedTranscript.trim() || !replaceReview(true)) return
    if (!analysis) {
      try {
        const existing = loadWorkshopReview(localStorage, processId, savedTranscript)
        if (existing.review && !window.confirm('Zastąpić zapisaną propozycję warsztatu nowym szkicem AS-IS?')) return
      } catch {
        setAnalysisMessage('Nie można odczytać zapisanej propozycji warsztatu.')
        return
      }
    }
    const proposal = proposeLocalWorkshop(savedTranscript)
    revision.current += 1
    setManualReview(false)
    const review = unreviewedProposal(proposal)
    review.steps = proposal.steps.map((step) => ({ ...step, reviewed: false }))
    setAnalysis({ ...review, source: 'local-transcript' })
    setSelectedSteps([])
    setReviewDirty(true)
    dirtyRef.current = true
    setAnalysisMessage(`Przygotowano lokalny szkic AS-IS. Proponowane kroki: ${proposal.steps.length}.`)
  }

  const analyze = async () => {
    if (!transcript.trim()) { setAnalysisMessage('Najpierw wklej transkrypcję.'); return }
    if (transcript.length > 20_000) { setAnalysisMessage('Do analizy można przekazać maksymalnie 20 000 znaków.'); return }
    if (!replaceReview()) return
    if (workshopAiRemote && !aiSession) { setAnalysisMessage('Zaloguj się, aby uruchomić analizę AI.'); return }
    if (!window.confirm('Transkrypcja zostanie wysłana do OpenAI w celu analizy. Użycie API może być płatne. Czy chcesz kontynuować?')) return
    transcriptImport.current += 1
    const currentRevision = revision.current
    const controller = new AbortController()
    activeAnalysis.current = controller
    setAnalyzing(true)
    setAnalysisMessage('')
    try {
      const response = workshopAiRemote ? await requestWorkshopAnalysis(transcript, workshopAiClient, controller.signal) : await fetch('/api/analyze-workshop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }), signal: controller.signal })
      if (activeAnalysis.current !== controller) return
      const result = workshopAiRemote ? response : await response.json()
      if (activeAnalysis.current !== controller) return
      if (!response.ok) {
        if (result.error === 'MISSING_API_KEY') throw new Error('Brakuje konfiguracji klucza API po stronie serwera.')
        if (result.error === 'UNVERIFIED_RESPONSE') throw new Error('Nie udało się potwierdzić fragmentów źródłowych. Spróbuj ponownie.')
        if (result.error === 'FORBIDDEN') throw new Error('Brak dostępu do analizy. Sprawdź logowanie i uprawnienia. Możesz kontynuować pracę ręcznie.')
        if (result.error === 'AUTH_UNAVAILABLE') throw new Error('Usługa logowania jest niedostępna. Analiza została zablokowana. Możesz kontynuować pracę ręcznie.')
        if (result.error === 'LIMIT_REACHED') throw new Error('Osiągnięto limit analiz AI. Możesz dalej opracowywać proces ręcznie i spróbować później.')
        if (result.error === 'PROVIDER_BILLING_LIMIT') throw new Error('Dostawca AI zablokował analizę z powodu limitu wydatków, wykorzystania lub braku środków. Sprawdź rozliczenia przed kolejną próbą. Możesz kontynuować pracę ręcznie.')
        if (result.error === 'USAGE_STORAGE_UNAVAILABLE') throw new Error('Nie można sprawdzić licznika analiz AI. Wynik może być niedostępny — sprawdź limit przed ponowieniem próby. Możesz kontynuować pracę ręcznie.')
        if (result.error === 'BUSY') throw new Error('Trwa już analiza AI. Zaczekaj na jej zakończenie, zanim uruchomisz kolejną.')
        if (result.error === 'RESULT_UNKNOWN') throw new Error('Nie otrzymano odpowiedzi. Analiza mogła już się rozpocząć, a ponowienie może zużyć kolejną próbę i spowodować koszt. Sprawdź połączenie i limit przed ponowieniem. Możesz pracować ręcznie.')
        if (result.error === 'TOO_LARGE') throw new Error('Żądanie jest zbyt duże. Skróć transkrypcję i spróbuj ponownie.')
        if (result.error === 'INVALID_TRANSCRIPT' || result.error === 'INVALID_REQUEST') throw new Error('Nieprawidłowe dane analizy. Sprawdź transkrypcję i spróbuj ponownie.')
        throw new Error('Nie udało się przeanalizować transkrypcji. Sprawdź konfigurację lub spróbuj później.')
      }
      if (revision.current !== currentRevision) setAnalysisMessage('Transkrypcja lub propozycja zmieniła się podczas analizy. Uruchom analizę ponownie.')
      else if (validateWorkshopProposal(result.proposal, transcript).length) setAnalysisMessage('Odpowiedź nie przeszła kontroli źródeł. Spróbuj ponownie.')
      else {
        setManualReview(false)
        setAnalysis(unreviewedProposal(result.proposal))
        setSelectedSteps([])
        setReviewDirty(true)
        dirtyRef.current = true
      }
    } catch (error) {
      if (activeAnalysis.current !== controller) return
      if (error.message === 'AI_LOGIN_REQUIRED') { setAnalysisMessage('Sesja wygasła. Zaloguj się ponownie.'); return }
      if (error.message === 'AI_NOT_CONFIGURED') { setAnalysisMessage('Analiza AI nie jest skonfigurowana.'); return }
      setAnalysisMessage(error.message.includes('JSON') || error instanceof TypeError ? 'Nie otrzymano odpowiedzi. Analiza mogła już się rozpocząć, a ponowienie może zużyć kolejną próbę i spowodować koszt. Sprawdź połączenie i limit przed ponowieniem. Możesz pracować ręcznie.' : error.message)
    } finally { if (activeAnalysis.current === controller) { activeAnalysis.current = null; setAnalyzing(false) } }
  }

  const stopWaiting = () => {
    const controller = activeAnalysis.current
    if (!controller) return
    activeAnalysis.current = null
    controller.abort()
    setAnalyzing(false)
    setAnalysisMessage('Przerwano oczekiwanie na wynik w tej przeglądarce. Analiza może nadal trwać na serwerze; próba mogła zostać wykorzystana i spowodować koszt. Przed ponowieniem sprawdź limit. Możesz pracować ręcznie.')
  }

  const updateItem = (category, index, update) => {
    revision.current += 1
    setAnalysis((current) => ({
      ...current,
      [category]: current[category].map((item, itemIndex) => itemIndex === index ? update(item) : item),
    }))
    setReviewDirty(true)
    dirtyRef.current = true
    setAnalysisMessage('')
  }

  const reviewItem = (category, index, reviewed) => {
    if (category === 'steps' && !reviewed && analysis.source === 'local-transcript') {
      setSelectedSteps((current) => current.filter((itemIndex) => itemIndex !== index))
    }
    updateItem(category, index, (item) => ({ ...item, reviewed }))
  }

  const editItem = (category, index, value, field = 'text') => {
    if (category === 'steps') setSelectedSteps((current) => current.filter((itemIndex) => itemIndex !== index))
    updateItem(category, index, (item) => ({
      ...item,
      [field]: value,
      reviewed: false,
      status: item.status === 'supported' ? 'assumption' : item.status,
      ...(category === 'questions' && { answerConfirmed: false }),
    }))
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
    if (validateWorkshopReview(analysis, manualReview ? '' : transcript).length) {
      setAnalysisMessage('Uzupełnij treść dodanych pozycji, sprawdź ich źródła i popraw ewentualne błędy w datach.')
      return
    }
    try {
      const existing = loadWorkshopReview(localStorage, processId, transcript)
      if (existing.stale && !window.confirm('Istnieje zapisana propozycja dla wcześniejszej wersji transkrypcji. Zastąpić ją?')) return
      saveWorkshopReview(localStorage, processId, transcript, analysis, { replaceStale: existing.stale, manual: manualReview })
      setReviewDirty(false)
      dirtyRef.current = false
      setAnalysisMessage('Propozycja zapisana na tym urządzeniu.')
    } catch { setAnalysisMessage('Nie udało się zapisać propozycji. Istniejące dane nie zostały nadpisane.') }
  }

  const insertFinding = (category, item) => {
    if (dirty || reviewDirty || !item.reviewed || !onUseFinding) return
    const result = onUseFinding(category, item.text)
    if (result?.cancelled) return
    if (result?.error) { setAnalysisMessage(result.error); return }
    if (result?.duplicate) { setAnalysisMessage('To ustalenie jest już w opisie formularza kroku.'); return }
    setAnalysisMessage('Wstawiono do formularza kroku poniżej. Aby zachować zmianę, dodaj krok lub zapisz jego edycję.')
  }

  const transferSteps = () => {
    if (!analysis || reviewDirty || dirty || !selectedSteps.length || !canTransferSteps || !onTransferSteps) return
    const steps = analysis.steps.filter((item, index) => selectedSteps.includes(index)
      && (analysis.source !== 'local-transcript' || item.reviewed === true))
    if (!steps.length) return
    const result = onTransferSteps(steps.map((item) => analysis.source === 'local-transcript'
      ? { name: item.text, owner: item.owner ?? '', system: item.system ?? '', description: item.description ?? '' }
      : item.text))
    if (result.error) { setAnalysisMessage(result.error); return }
    setSelectedSteps([])
    setAnalysisMessage(`Dodano kroków: ${result.added}. Pominięto istniejących lub powtórzonych: ${result.skipped}. Sprawdź listę kroków poniżej i zapisz proces AS-IS.`)
  }

  const openQuestions = analysis?.questions.filter((item) => !item.answerConfirmed) ?? []
  const today = getLocalWorkshopDate()
  const isOverdue = ({ answerConfirmed, dueDate }) => !answerConfirmed && Boolean(dueDate) && dueDate < today
  const overdueCount = openQuestions.filter(isOverdue).length
  const exportableQuestions = openQuestions.filter((item) => item.reviewed)
  const canDownloadQuestions = exportableQuestions.length > 0 && !dirty && !reviewDirty && !analyzing

  const downloadQuestions = () => {
    if (!canDownloadQuestions) return
    const link = document.createElement('a')
    let url
    try {
      const text = formatOpenWorkshopQuestions(exportableQuestions, processName)
      url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
      link.href = url
      link.download = 'otwarte-pytania.txt'
      document.body.appendChild(link)
      link.click()
    } catch {
      setAnalysisMessage('Nie udało się przygotować listy pytań do pobrania.')
    } finally {
      link.remove()
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }

  if (storageUncertain) return (
    <section className="workshop-panel" aria-labelledby="workshop-storage-error">
      <h2 id="workshop-storage-error">Nie można potwierdzić stanu zapisu</h2>
      <p role="alert">Usuwanie warsztatu nie powiodło się i nie udało się w pełni przywrócić danych. Edycja została wstrzymana, aby nie nadpisać pozostałych danych. Sprawdź zapis przed dalszą pracą.</p>
      <label htmlFor="workshop-recovery-text">Tekst dostępny w tym oknie — możesz go skopiować w bezpieczne miejsce</label>
      <textarea id="workshop-recovery-text" rows="9" value={transcript} readOnly />
    </section>
  )

  return (
    <section className="workshop-panel" aria-labelledby="workshop-title">
      <h2 id="workshop-title">Ustalenia warsztatowe</h2>
      {draftError && <p role="alert">{draftError}</p>}
      <p>Kliknij „Opracuj ręcznie”, aby zapisywać ustalenia już w trakcie spotkania. Tekst rozmowy możesz wkleić i zapisać później. Zapisy trafiają do tej przeglądarki. Uważaj na dane poufne i osoby korzystające z tego urządzenia.</p>
      {analysisAvailable && <p>Analiza AI wysyła transkrypcję do OpenAI po Twoim potwierdzeniu. Wpisanie lub zapisanie tekstu nie uruchamia analizy.</p>}
      {!localWorkshop && <p>{analysisAvailable ? 'Możesz opracować ustalenia ręcznie lub przygotować propozycję z AI.' : 'Możesz opracować ustalenia ręcznie.'} W trybie dodawania kroków możesz przenieść zapisane ustalenia do AS-IS.</p>}
      {analysisAvailable && workshopAiRemote && <div>
        {!workshopAiClient ? <p>Analiza AI nie jest skonfigurowana.</p> : aiSession ? <div><p>Zalogowano do analizy AI.</p><button type="button" disabled={authBusy} onClick={signOutAi}>Wyloguj z analizy AI</button></div> : <form onSubmit={signInAi}>
          <label htmlFor="ai-email">E-mail do analizy AI</label>
          <input id="ai-email" type="email" autoComplete="username" value={aiEmail} onChange={(event) => setAiEmail(event.target.value)} required />
          <label htmlFor="ai-password">Hasło do analizy AI</label>
          <input id="ai-password" type="password" autoComplete="current-password" value={aiPassword} onChange={(event) => setAiPassword(event.target.value)} required />
          <button type="submit" disabled={authBusy}>{authBusy ? 'Logowanie…' : 'Zaloguj do analizy AI'}</button>
        </form>}
        {authMessage && <p role="status">{authMessage}</p>}
      </div>}
      {localWorkshop && <WorkshopRecorder processId={processId} recordingRef={recordingRef}
        onTranscribe={readError || analyzing ? undefined : transcribeRecording} transcribing={transcribing}
        onCancelTranscription={() => localTranscription.current?.abort()} />}
      <label htmlFor="workshop-transcript">Tekst rozmowy</label>
      <textarea id="workshop-transcript" rows="9" maxLength={MAX_TRANSCRIPT_LENGTH} value={transcript} disabled={Boolean(readError)} onChange={(event) => changeTranscript(event.target.value)} placeholder="Wklej transkrypcję warsztatu…" />
      <label htmlFor="workshop-transcript-file">Wczytaj transkrypcję z pliku TXT</label>
      <input id="workshop-transcript-file" type="file" accept=".txt,text/plain" disabled={Boolean(readError) || analyzing} onChange={importTranscript} />
      <div className="workshop-actions">
        <button type="button" className="save-button" disabled={Boolean(readError) || !dirty} onClick={save}>Zapisz transkrypcję</button>
        {localWorkshop && <button type="button" className="save-button"
          disabled={Boolean(readError || reviewLoadError) || dirty || !savedTranscript.trim() || transcribing}
          onClick={prepareLocalProposal}>Przygotuj szkic AS-IS lokalnie</button>}
        <button type="button" className="save-button" disabled={Boolean(readError) || analyzing || !analysisAvailable} onClick={analyze}>{analyzing ? 'Analizuję…' : 'Analizuj transkrypcję'}</button>
        {analyzing && <button type="button" className="back-button" onClick={stopWaiting}>Przerwij oczekiwanie</button>}
        <button type="button" className="back-button" disabled={Boolean(readError) || analyzing} onClick={startManual}>Opracuj ręcznie</button>
        <button type="button" className="back-button" disabled={analyzing} onClick={clearWorkshop}>Usuń dane warsztatu</button>
        <span>{transcript.length} / {MAX_TRANSCRIPT_LENGTH} znaków</span>
      </div>
      {localWorkshop && <p>Zapisz tekst rozmowy i przygotuj szkic AS-IS. Propozycje powstają w tej przeglądarce na podstawie reguł językowych.</p>}
      {!analysisAvailable && !localWorkshop && <p>Analiza AI nie jest jeszcze dostępna w tym podglądzie. Możesz opracować ustalenia ręcznie.</p>}
      {dirty && <p role="status">Masz niezapisane zmiany w transkrypcji.</p>}
      {message && <p role="status">{message}</p>}
      {!dirty && savedAt && !message && <p>Transkrypcja została wcześniej zapisana na tym urządzeniu.</p>}
      {staleReview && !analysis && <p>Istnieje propozycja dla wcześniejszej wersji transkrypcji.</p>}
      {reviewLoadError && <p role="alert">{reviewLoadError}</p>}
      {analysisMessage && <p role="status">{analysisMessage}</p>}
      {analysis && <div className="workshop-results">
        <h3>Propozycja do sprawdzenia</h3>
        {analysis.source === 'local-transcript'
          ? <p>Porównaj nazwę kroku, wykonawcę, system i opis z fragmentem rozmowy. Popraw dane i zaznacz „Sprawdzono treść” przy wybranym kroku. Pola do potwierdzenia możesz zostawić puste. Zapisz propozycję i przenieś wybrane kroki do AS-IS.</p>
          : <>
            <p>Popraw lub dodaj ustalenia, w tym systemy i wyjątki. Systemy i wyjątki dodajesz ręcznie. Po sprawdzeniu zaznacz wybrane pozycje i zapisz propozycję. Zmiana treści cofa oznaczenie. Zapis pozostaje w tej przeglądarce.</p>
            <p>Cytat pomaga odnaleźć fragment rozmowy, ale nie potwierdza poprawności propozycji. Przed przeniesieniem kroków sprawdź ich treść i kontekst.</p>
          </>}
        {Object.entries(categories).map(([key, title]) => <div key={key}>
          <h4>{title}</h4>
          {key === 'questions' && analysis.questions.length > 0 && <>
            <p role="status">
              Otwarte pytania: {openQuestions.length} z {analysis.questions.length}.
              {overdueCount > 0 && <> Po terminie: {overdueCount}.</>}
              {' '}Potwierdź odpowiedź po jej uzgodnieniu. Zmiana pytania lub odpowiedzi ponownie otwiera pytanie.
            </p>
            <label><input type="checkbox" ref={openQuestionFilter} checked={onlyOpenQuestions}
              onChange={(event) => setOnlyOpenQuestions(event.target.checked)} /> Pokaż tylko otwarte pytania</label>
            {onlyOpenQuestions && openQuestions.length === 0 && <p>Brak otwartych pytań.</p>}
            {openQuestions.length > 0 && <div className="workshop-actions">
              <button type="button" className="back-button" disabled={!canDownloadQuestions} onClick={downloadQuestions}>Pobierz otwarte pytania (.txt)</button>
              <span>Plik zawiera pytania oznaczone „Sprawdzono treść”. Przed pobraniem zapisz propozycję.</span>
            </div>}
          </>}
          {analysis[key].length > 0 && !(key === 'questions' && onlyOpenQuestions && !openQuestions.length) && <ul>{analysis[key].map((item, index) => (
            key === 'questions' && onlyOpenQuestions && item.answerConfirmed ? null : <li key={`${key}-${index}`}>
            {key === 'steps' && canTransferSteps && <label><input type="checkbox" checked={selectedSteps.includes(index)}
              disabled={analysis.source === 'local-transcript' && item.reviewed !== true}
              onChange={(event) => setSelectedSteps((current) => event.target.checked ? [...current, index] : current.filter((itemIndex) => itemIndex !== index))} /> Wybierz krok {index + 1} do przeniesienia</label>}
            <label htmlFor={`review-${key}-${index}`}>{title} — pozycja {index + 1}</label>
            <textarea id={`review-${key}-${index}`} rows="2" value={item.text} onChange={(event) => editItem(key, index, event.target.value)} />
            <small>{item.status === 'supported' ? 'Źródło propozycji: cytat z rozmowy' : item.status === 'question' ? 'Rodzaj: pytanie' : analysis.source === 'local-transcript' && item.evidence ? 'Treść poprawiona podczas sprawdzania' : 'Źródło propozycji: założenie lub wpis ręczny'}</small>
            {key === 'steps' && analysis.source === 'local-transcript' && <div className="workshop-question-followup">
              {Object.entries({ owner: 'Wykonawca', system: 'System' }).map(([field, label]) => <div key={field}>
                <label htmlFor={`review-${field}-${index}`}>{label} — krok {index + 1}</label>
                <input id={`review-${field}-${index}`} type="text" value={item[field] ?? ''}
                  aria-describedby={!item[field]?.trim() ? `review-${field}-hint-${index}` : undefined}
                  onChange={(event) => editItem(key, index, event.target.value, field)} />
                {!item[field]?.trim() && <small id={`review-${field}-hint-${index}`}>Do potwierdzenia</small>}
              </div>)}
            </div>}
            {key === 'steps' && analysis.source === 'local-transcript' && <>
              <label htmlFor={`review-description-${index}`}>Opis czynności — krok {index + 1}</label>
              <textarea id={`review-description-${index}`} rows="2" value={item.description ?? ''}
                aria-describedby={!item.description?.trim() ? `description-hint-${index}` : undefined}
                onChange={(event) => editItem(key, index, event.target.value, 'description')} />
              {!item.description?.trim() && <small id={`description-hint-${index}`}>Do potwierdzenia</small>}
            </>}
            <label><input type="checkbox" checked={item.reviewed === true} disabled={!item.text.trim()} onChange={(event) => reviewItem(key, index, event.target.checked)} /> Sprawdzono treść — {title.toLowerCase()}, pozycja {index + 1}</label>
            {key === 'questions' && <>
              <div className="workshop-question-followup">
                <div>
                  <label htmlFor={`review-assignee-${index}`}>Kto wróci z odpowiedzią — pytanie {index + 1}</label>
                  <input id={`review-assignee-${index}`} type="text" maxLength={MAX_WORKSHOP_ASSIGNEE_LENGTH}
                    value={item.assignee ?? ''} onChange={(event) => updateItem(key, index, (current) => ({
                      ...current, assignee: event.target.value,
                    }))} />
                </div>
                <div>
                  <label htmlFor={`review-due-date-${index}`}>Termin odpowiedzi — pytanie {index + 1}</label>
                  <input id={`review-due-date-${index}`} type="date" max="9999-12-31"
                    value={item.dueDate ?? ''} onChange={(event) => updateItem(key, index, (current) => ({
                      ...current, dueDate: event.target.value,
                    }))} />
                  {isOverdue(item) && <p>Po terminie</p>}
                </div>
              </div>
              <label htmlFor={`review-answer-${index}`}>Odpowiedź — pytanie {index + 1}</label>
              <textarea id={`review-answer-${index}`} rows="2" maxLength={MAX_WORKSHOP_ANSWER_LENGTH}
                value={item.answer ?? ''} onChange={(event) => updateItem(key, index, (current) => ({
                  ...current, answer: event.target.value, answerConfirmed: false,
                }))} />
              <label><input type="checkbox" checked={item.answerConfirmed === true} disabled={!item.text.trim() || !item.answer?.trim()}
                onChange={(event) => {
                  const checked = event.target.checked
                  if (checked && onlyOpenQuestions) openQuestionFilter.current?.focus()
                  updateItem(key, index, (current) => ({ ...current, answerConfirmed: checked }))
                }} /> Potwierdzono odpowiedź — pytanie {index + 1}</label>
            </>}
            {canTransferSteps && onUseFinding && ['roles', 'systems', 'decisions', 'exceptions'].includes(key) && <button type="button" className="back-button" disabled={dirty || reviewDirty || !item.reviewed} onClick={() => insertFinding(key, item)}>Wstaw {({ roles: 'rolę', systems: 'system', decisions: 'decyzję', exceptions: 'wyjątek' })[key]} do formularza kroku — pozycja {index + 1}</button>}
            {item.evidence && <blockquote>Fragment rozmowy: {item.evidence}</blockquote>}
            <button type="button" className="back-button" onClick={() => removeItem(key, index)}>Usuń pozycję {index + 1} — {title.toLowerCase()}</button>
          </li>))}</ul>}
          {analysis[key].length === 0 && <p>Brak propozycji.</p>}
          <button type="button" className="back-button" onClick={() => addItem(key)}>Dodaj: {title.toLowerCase()}</button>
        </div>)}
        <div className="workshop-actions"><button type="button" className="save-button" disabled={!reviewDirty || Boolean(reviewLoadError)} onClick={saveReview}>Zapisz propozycję</button></div>
        {reviewDirty && <p role="status">Masz niezapisaną propozycję.</p>}
        {canTransferSteps ? <div className="workshop-actions">
          <button type="button" className="save-button" disabled={!selectedSteps.length || reviewDirty || dirty} onClick={transferSteps}>Przenieś wybrane kroki do AS-IS</button>
          <span>Najpierw zapisz propozycję. Sprawdzone role, systemy, decyzje i wyjątki możesz wstawić do formularza kroku. Aby uzupełnić istniejący krok, najpierw wybierz jego edycję.</span>
        </div> : <p>Przenoszenie kroków jest dostępne w trybie „Dodaj kroki samodzielnie”.</p>}
        {canTransferSteps && onApplyDocument && analysis.source === 'local-transcript' && !dirty && !reviewDirty && !staleReview && !reviewLoadError && <WorkshopDocuments analysis={analysis} steps={mapSteps} transcript={savedTranscript} onApply={onApplyDocument} onPrepareHandoff={onPrepareHandoff} />}
        {canTransferSteps && onApplyDecision && !dirty && !reviewDirty && !staleReview && !reviewLoadError && <WorkshopDecision analysis={analysis} steps={mapSteps} transcript={savedTranscript} onApply={onApplyDecision} />}
      </div>}
    </section>
  )
}
