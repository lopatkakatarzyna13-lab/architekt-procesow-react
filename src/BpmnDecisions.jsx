import { useState } from 'react'

function DecisionForm({ step, onSave, onDraftChange, variant }) {
  const [question, setQuestion] = useState(step.bpmnDecision?.question || '')
  const [mainLabel, setMainLabel] = useState(step.bpmnDecision?.mainLabel || '')
  const [message, setMessage] = useState('')
  return <form onSubmit={(event) => {
    event.preventDefault()
    const result = onSave(step.id, question, mainLabel)
    if (!result?.error) { setQuestion(question.trim()); setMainLabel(mainLabel.trim()); onDraftChange(step.id, false) }
    setMessage(result?.error || `Zapisano ustawienia bramki. Zapisz proces ${variant}.`)
  }}>
    <h3>Decyzja po kroku: {step.name}</h3>
    <p>Podaj pytanie oraz warunek przejścia do kolejnego kroku z listy. Opisy pozostałych przejść pochodzą z dodanych połączeń. Przyjmij, że możliwy jest wybór jednej ścieżki.</p>
    <label htmlFor={`gateway-question-${step.id}`}>Pytanie decyzji — {step.name}</label>
    <input id={`gateway-question-${step.id}`} value={question} onChange={(event) => { const value = event.target.value; setQuestion(value); onDraftChange(step.id, value !== (step.bpmnDecision?.question || '') || mainLabel !== (step.bpmnDecision?.mainLabel || '')) }} maxLength={120} required />
    <label htmlFor={`gateway-main-${step.id}`}>Kiedy kontynuować podstawową ścieżkę — {step.name}</label>
    <input id={`gateway-main-${step.id}`} value={mainLabel} onChange={(event) => { const value = event.target.value; setMainLabel(value); onDraftChange(step.id, question !== (step.bpmnDecision?.question || '') || value !== (step.bpmnDecision?.mainLabel || '')) }} maxLength={120} required />
    <button type="submit" className="back-button">Zapisz decyzję BPMN — {step.name}</button>
    {(question !== (step.bpmnDecision?.question || '') || mainLabel !== (step.bpmnDecision?.mainLabel || '')) && <p>Masz niezapisane zmiany decyzji. Zapisz decyzję BPMN przed zapisaniem procesu.</p>}
    {message && <p role="status">{message}</p>}
  </form>
}

export default function BpmnDecisions({ steps, onSave, onDraftChange, variant = 'AS-IS' }) {
  const sources = steps.filter((step) => Array.isArray(step.extraConnections) && step.extraConnections.length > 0)
  if (!sources.length) return null
  return <section className="step-connections" aria-labelledby="bpmn-decisions-title">
    <h2 id="bpmn-decisions-title">Decyzje do eksportu BPMN</h2>
    <p>Dla każdego kroku z dodatkową ścieżką określ, kiedy wybrać przebieg podstawowy. Aplikacja utworzy bramkę wyboru jednej ścieżki; sprawdź, czy to odpowiada procesowi. Opisy warunków są tekstem, nie regułami automatycznymi.</p>
    {sources.map((step) => <DecisionForm key={step.id} step={step} variant={variant} onSave={onSave} onDraftChange={onDraftChange} />)}
  </section>
}
