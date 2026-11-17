import { useState } from 'react'

function LaneForm({ step, index, onSave, onDraftChange }) {
  const saved = typeof step.bpmnLane === 'string' ? step.bpmnLane : ''
  const [value, setValue] = useState(saved)
  const [message, setMessage] = useState('')
  const key = `lane:${step.id}`
  return <form onSubmit={(event) => {
    event.preventDefault()
    const result = onSave(step.id, value)
    if (!result?.error) { setValue(value.trim()); onDraftChange(key, false) }
    setMessage(result?.error || 'Zapisano tor w wersji roboczej. Zapisz proces AS-IS.')
  }}>
    <label htmlFor={`bpmn-lane-${step.id}`}>Tor BPMN — krok {index + 1}: {step.name}</label>
    <input id={`bpmn-lane-${step.id}`} value={value} maxLength={80} placeholder="np. HR" onChange={(event) => { const next = event.target.value; setValue(next); onDraftChange(key, next !== saved) }} />
    <button type="submit" className="back-button">Zapisz tor — krok {index + 1}: {step.name}</button>
    {value !== saved && <p>Masz niezapisany tor. Zapisz tor przed zapisaniem procesu.</p>}
    {message && <p role="status">{message}</p>}
  </form>
}

export default function BpmnLanes({ steps, onSave, onDraftChange }) {
  if (!steps.length) return null
  return <section className="step-connections" aria-labelledby="bpmn-lanes-title">
    <h2 id="bpmn-lanes-title">Tory ról w BPMN</h2>
    <p>Opcjonalnie przypisz każdy krok do toru, np. „HR” lub „Biuro rachunkowe”. Jednakowe nazwy tworzą wspólny tor. Nazwy nie są automatycznie przepisywane z pól odpowiedzialności.</p>
    <p>Jeśli przypiszesz choć jeden tor, uzupełnij wszystkie kroki. Zdarzenia i bramki zostaną pokazane na torach sąsiednich kroków; sprawdź ich położenie w podglądzie.</p>
    {steps.map((step, index) => <LaneForm key={step.id} step={step} index={index} onSave={onSave} onDraftChange={onDraftChange} />)}
  </section>
}
