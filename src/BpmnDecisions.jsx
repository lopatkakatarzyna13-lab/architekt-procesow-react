import { useState } from 'react'

function DecisionForm({ step, onSave, onDraftChange, variant, workshopDecisions }) {
  const [question, setQuestion] = useState(step.bpmnDecision?.question || '')
  const [mainLabel, setMainLabel] = useState(step.bpmnDecision?.mainLabel || '')
  const [message, setMessage] = useState('')
  const [selectedDecision, setSelectedDecision] = useState('')
  const workshopQuestion = workshopDecisions.includes(selectedDecision) ? selectedDecision : ''

  const changeQuestion = (value) => {
    setQuestion(value)
    onDraftChange(step.id, value !== (step.bpmnDecision?.question || '') || mainLabel !== (step.bpmnDecision?.mainLabel || ''))
  }

  const insertWorkshopQuestion = () => {
    if (!workshopQuestion) return
    if (workshopQuestion.length > 120) {
      setMessage('Ustalenie przekracza 120 znaków. Wpisz krótsze pytanie decyzji w formularzu.')
      return
    }
    if (question.trim() && question.trim() !== workshopQuestion && !window.confirm('Zastąpić bieżące pytanie decyzją z warsztatu?')) return
    changeQuestion(workshopQuestion)
    setSelectedDecision('')
    setMessage('Wstawiono pytanie. Uzupełnij warunek podstawowej ścieżki i zapisz decyzję BPMN.')
  }
  return <form onSubmit={(event) => {
    event.preventDefault()
    const result = onSave(step.id, question, mainLabel)
    if (!result?.error) { setQuestion(question.trim()); setMainLabel(mainLabel.trim()); onDraftChange(step.id, false) }
    setMessage(result?.error || `Zapisano ustawienia bramki. Zapisz proces ${variant}.`)
  }}>
    <h3>Decyzja po kroku: {step.name}</h3>
    <p>Podaj pytanie oraz warunek przejścia ścieżką podstawową. Jej cel możesz ustawić w sekcji „Przebieg podstawowy”. Opisy pozostałych ścieżek pochodzą z dodanych połączeń.</p>
    {workshopDecisions.length > 0 && <>
      <label htmlFor={`gateway-workshop-${step.id}`}>Sprawdzona decyzja z warsztatu — {step.name}</label>
      <select id={`gateway-workshop-${step.id}`} value={workshopQuestion} onChange={(event) => setSelectedDecision(event.target.value)}>
        <option value="">Wybierz decyzję</option>
        {workshopDecisions.map((decision) => <option key={decision} value={decision}>{decision}</option>)}
      </select>
      <button type="button" className="back-button" disabled={!workshopQuestion} onClick={insertWorkshopQuestion}>Wstaw pytanie z warsztatu — {step.name}</button>
    </>}
    <label htmlFor={`gateway-question-${step.id}`}>Pytanie decyzji — {step.name}</label>
    <input id={`gateway-question-${step.id}`} value={question} onChange={(event) => changeQuestion(event.target.value)} maxLength={120} required />
    <label htmlFor={`gateway-main-${step.id}`}>Kiedy kontynuować podstawową ścieżkę — {step.name}</label>
    <input id={`gateway-main-${step.id}`} value={mainLabel} onChange={(event) => { const value = event.target.value; setMainLabel(value); onDraftChange(step.id, question !== (step.bpmnDecision?.question || '') || value !== (step.bpmnDecision?.mainLabel || '')) }} maxLength={120} required />
    <button type="submit" className="back-button">Zapisz decyzję BPMN — {step.name}</button>
    {(question !== (step.bpmnDecision?.question || '') || mainLabel !== (step.bpmnDecision?.mainLabel || '')) && <p>Masz niezapisane zmiany decyzji. Zapisz decyzję BPMN przed zapisaniem procesu.</p>}
    {message && <p role="status">{message}</p>}
  </form>
}

export default function BpmnDecisions({ steps, onSave, onDraftChange, variant = 'AS-IS', workshopDecisions = [] }) {
  const sources = steps.filter((step) => Array.isArray(step.extraConnections) && step.extraConnections.length > 0)
  if (!sources.length) return null
  return <section className="step-connections" aria-labelledby="bpmn-decisions-title">
    <h2 id="bpmn-decisions-title">Decyzje do eksportu BPMN</h2>
    <p>Dla każdego kroku z dodatkową ścieżką określ, kiedy wybrać przebieg podstawowy. Aplikacja utworzy bramkę wyboru jednej ścieżki; sprawdź, czy to odpowiada procesowi. Opisy warunków są tekstem, nie regułami automatycznymi.</p>
    {sources.map((step) => <DecisionForm key={step.id} step={step} variant={variant} workshopDecisions={workshopDecisions} onSave={onSave} onDraftChange={onDraftChange} />)}
  </section>
}
