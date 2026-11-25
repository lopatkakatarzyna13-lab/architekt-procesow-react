import { useState } from 'react'
import { proposeRoleLanes } from './roleLanes.js'

function LaneForm({ step, index, onSave, onDraftChange, variant, proposal }) {
  const saved = typeof step.bpmnLane === 'string' ? step.bpmnLane : ''
  const [draft, setDraft] = useState(null)
  const value = draft ?? saved
  const [message, setMessage] = useState('')
  const key = `lane:${step.id}`
  return <form onSubmit={(event) => {
    event.preventDefault()
    const result = onSave(step.id, value)
    if (!result?.error) { setDraft(null); onDraftChange(key, false) }
    setMessage(result?.error || `Zapisano tor w wersji roboczej. Zapisz proces ${variant}.`)
  }}>
    <label htmlFor={`bpmn-lane-${step.id}`}>Tor BPMN — krok {index + 1}: {step.name}</label>
    <input id={`bpmn-lane-${step.id}`} value={value} maxLength={80} placeholder="np. HR" onChange={(event) => { const next = event.target.value; setDraft(next === saved ? null : next); onDraftChange(key, next !== saved) }} />
    {proposal && <p>{proposal.reason ?? `Proponowany tor: ${proposal.lane}`}</p>}
    <button type="submit" className="back-button">Zapisz tor — krok {index + 1}: {step.name}</button>
    {value !== saved && <p>Masz niezapisany tor. Zapisz tor przed zapisaniem procesu.</p>}
    {message && <p role="status">{message}</p>}
  </form>
}

export default function BpmnLanes({ steps, externalSteps, onSave, onApplyRoles, busy, onDraftChange, variant = 'AS-IS' }) {
  const [message, setMessage] = useState('')
  if (!steps.length) return null
  const proposals = proposeRoleLanes(steps, externalSteps)
  const needsReview = [...proposals.values()].some((item) => item.reason)
  return <section className="step-connections" aria-labelledby="bpmn-lanes-title">
    <h2 id="bpmn-lanes-title">Tory ról w BPMN</h2>
    <p>Tor pokazuje, kto wykonuje krok wewnątrz organizacji. Sprawdź proponowane przypisania poniżej. Możesz zapisać własną nazwę przy wybranym kroku.</p>
    <p>Jeśli przypiszesz choć jeden tor, uzupełnij wszystkie kroki. Zdarzenia i bramki zostaną pokazane na torach sąsiednich kroków; sprawdź ich położenie w podglądzie.</p>
    {steps.map((step, index) => <LaneForm key={step.id} step={step} index={index} variant={variant} proposal={proposals.get(step.id)} onSave={onSave} onDraftChange={onDraftChange} />)}
    {proposals.size > 0 && <div>
      <button type="button" className="save-button" disabled={busy || needsReview} onClick={() => {
        const result = onApplyRoles()
        setMessage(result?.error || `Przypisano tory według wykonawców. Zapisz proces ${variant}.`)
      }}>Zatwierdź tory według wykonawców</button>
      {needsReview && <p>Uzupełnij wskazane kroki, by zatwierdzić pozostałe przypisania razem.</p>}
    </div>}
    {message && <p role="status">{message}</p>}
  </section>
}
