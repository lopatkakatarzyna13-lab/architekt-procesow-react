import { useState } from 'react'

export default function BpmnExternalSteps({ steps, externalSteps, onChange, onDraftChange, variant = 'AS-IS' }) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')
  const messages = steps.flatMap((step) => step.bpmnMessages || [])
  const add = (event) => {
    event.preventDefault()
    const value = name.trim()
    if (!value || value.length > 100) return
    const result = onChange([...externalSteps, { id: crypto.randomUUID(), name: value }])
    if (result?.error) { setStatus(result.error); return }
    setName(''); onDraftChange('external-step-form', false)
    setStatus(`Dodano działanie. Zapisz proces ${variant}.`)
  }
  return <section className="step-connections" aria-labelledby="external-steps-title">
    <h2 id="external-steps-title">Działania w basenie zewnętrznym</h2>
    <p>Dodaj znane Ci działania uczestnika zewnętrznego w kolejności ich wykonania. Kolejne działania zostaną połączone przepływem sekwencji. Aby pokazać basen, dodaj przynajmniej jedną wiadomość poniżej. Możesz też pozostawić listę pustą.</p>
    <form onSubmit={add}><label htmlFor="external-step-name">Nazwa działania</label>
      <input id="external-step-name" maxLength={100} value={name} onChange={(event) => { setName(event.target.value); onDraftChange('external-step-form', Boolean(event.target.value)) }} />
      <button type="submit" className="back-button">Dodaj działanie zewnętrzne</button>
      {name && <button type="button" className="back-button" onClick={() => { setName(''); onDraftChange('external-step-form', false) }}>Wyczyść działanie</button>}
    </form>
    {externalSteps.length > 0 && <ol>{externalSteps.map((item, index) => <li key={item.id}>{item.name}{' '}
      <button type="button" className="back-button" disabled={index === 0} aria-label={`Przesuń działanie ${item.name} w górę`} onClick={() => { const next = [...externalSteps]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; const result = onChange(next); setStatus(result?.error || `Zmieniono kolejność. Zapisz proces ${variant}.`) }}>↑</button>{' '}
      <button type="button" className="back-button" disabled={index === externalSteps.length - 1} aria-label={`Przesuń działanie ${item.name} w dół`} onClick={() => { const next = [...externalSteps]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; const result = onChange(next); setStatus(result?.error || `Zmieniono kolejność. Zapisz proces ${variant}.`) }}>↓</button>{' '}
      <button type="button" className="back-button" onClick={() => { if (messages.some((message) => message?.externalStepId === item.id)) { setStatus('Najpierw usuń wiadomości powiązane z tym działaniem.'); return }; const result = onChange(externalSteps.filter((step) => step.id !== item.id)); setStatus(result?.error || `Usunięto działanie. Zapisz proces ${variant}.`) }}>Usuń działanie {item.name}</button>
    </li>)}</ol>}
    {status && <p role="status">{status}</p>}
  </section>
}
