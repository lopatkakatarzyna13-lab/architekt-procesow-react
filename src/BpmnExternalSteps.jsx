import { useState } from 'react'
import { getBpmnMessages, getExternalActionPool, getExternalPools } from './bpmnMessages'

export default function BpmnExternalSteps({ steps, externalSteps, externalLinks = [], onChange, onDraftChange, variant = 'AS-IS' }) {
  const [name, setName] = useState('')
  const [participant, setParticipant] = useState('')
  const [status, setStatus] = useState('')
  const messages = getBpmnMessages(steps)
  const pools = getExternalPools(messages)
  const hasMessage = (id) => messages.some((message) => message.externalStepId === id) ||
    externalLinks.some((link) => link.sourceActionId === id || link.targetActionId === id)
  const add = (event) => {
    event.preventDefault()
    const value = name.trim()
    if (!value || value.length > 100) return
    const result = onChange([...externalSteps, { id: crypto.randomUUID(), name: value, ...(participant.trim() ? { participant: participant.trim() } : {}) }])
    if (result?.error) { setStatus(result.error); return }
    setName(''); setParticipant(''); onDraftChange('external-step-form', false)
    setStatus(`Dodano działanie. Zapisz proces ${variant}.`)
  }
  return <section className="step-connections" aria-labelledby="external-steps-title">
    <h2 id="external-steps-title">Działania w basenie zewnętrznym</h2>
    <p>Dodaj znane Ci działania uczestnika zewnętrznego w kolejności ich wykonania. Kolejne działania zostaną połączone przepływem sekwencji. Podaj nazwę basenu, jeśli proces ma kilku uczestników zewnętrznych. Dla każdego użytego basenu dodaj przynajmniej jedną wiadomość.</p>
    <form onSubmit={add}><label htmlFor="external-step-name">Nazwa działania</label>
      <input id="external-step-name" maxLength={100} value={name} onChange={(event) => { setName(event.target.value); onDraftChange('external-step-form', Boolean(event.target.value || participant)) }} />
      <label htmlFor="external-step-participant">Basen działania (opcjonalnie)</label>
      <input id="external-step-participant" maxLength={100} value={participant} onChange={(event) => { setParticipant(event.target.value); onDraftChange('external-step-form', Boolean(name || event.target.value)) }} />
      <button type="submit" className="back-button">Dodaj działanie zewnętrzne</button>
      {(name || participant) && <button type="button" className="back-button" onClick={() => { setName(''); setParticipant(''); onDraftChange('external-step-form', false) }}>Wyczyść działanie</button>}
    </form>
    {externalSteps.length > 0 && <ol>{externalSteps.map((item, index) => <li key={item.id}>{item.name}{' '}
      {!hasMessage(item.id) && pools.length > 0 && (
        <label>Basen działania {item.name}{' '}
          <select value={getExternalActionPool(item, messages, pools)} onChange={(event) => {
            const participantName = pools.find(([key]) => key === event.target.value)?.[1]
            if (!participantName) return
            const result = onChange(externalSteps.map((action) => action.id === item.id ? { ...action, participant: participantName } : action))
            setStatus(result?.error || `Przypisano basen. Zapisz proces ${variant}.`)
          }}>
            <option value="" disabled>Wybierz basen</option>
            {pools.map(([key, poolName]) => <option key={key} value={key}>{poolName}</option>)}
          </select>
        </label>
      )}
      <button type="button" className="back-button" disabled={index === 0} aria-label={`Przesuń działanie ${item.name} w górę`} onClick={() => { const next = [...externalSteps]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; const result = onChange(next); setStatus(result?.error || `Zmieniono kolejność. Zapisz proces ${variant}.`) }}>↑</button>{' '}
      <button type="button" className="back-button" disabled={index === externalSteps.length - 1} aria-label={`Przesuń działanie ${item.name} w dół`} onClick={() => { const next = [...externalSteps]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; const result = onChange(next); setStatus(result?.error || `Zmieniono kolejność. Zapisz proces ${variant}.`) }}>↓</button>{' '}
      <button type="button" className="back-button" onClick={() => { if (hasMessage(item.id)) { setStatus('Najpierw usuń wiadomości powiązane z tym działaniem.'); return }; const result = onChange(externalSteps.filter((step) => step.id !== item.id)); setStatus(result?.error || `Usunięto działanie. Zapisz proces ${variant}.`) }}>Usuń działanie {item.name}</button>
    </li>)}</ol>}
    {status && <p role="status">{status}</p>}
  </section>
}
