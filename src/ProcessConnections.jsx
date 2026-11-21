import { useState } from 'react'
import { getProcessConnections } from './processConnections.js'

export default function ProcessConnections({ steps, onAdd, onRemove, onSetNext, variant = 'AS-IS' }) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState('')
  const [nextSource, setNextSource] = useState('')
  const [nextMessage, setNextMessage] = useState('')
  const connections = getProcessConnections(steps)
  const nextSourceStep = steps.find((step) => step.id === nextSource)
  const overrides = steps.filter((step) => step.nextStepId)
  const name = (id) => steps.find((step) => step.id === id)?.name ?? 'Nieznany krok'
  const add = (event) => {
    event.preventDefault()
    const result = onAdd(source, target, label)
    if (result?.error) { setMessage(result.error); return }
    setLabel('')
    setMessage(`Dodano połączenie. Zapisz proces ${variant}, aby zachować je w bibliotece.`)
  }
  return <section className="step-connections" aria-labelledby="connections-title">
    <h2 id="connections-title">Dodatkowe połączenia kroków</h2>
    <p>Dodaj ścieżkę wymagającą wyboru po decyzji. Przejście bez wyboru ustaw w sekcji „Przebieg podstawowy”.</p>
    {steps.length < 2 ? <p>Dodaj co najmniej dwa kroki, aby połączyć je dodatkową ścieżką.</p> : <form onSubmit={add}>
      <label htmlFor="connection-source">Od kroku</label>
      <select id="connection-source" value={source} onChange={(event) => setSource(event.target.value)} required>
        <option value="">Wybierz krok</option>{steps.map((step, index) => <option key={step.id} value={step.id}>{index + 1}. {step.name}</option>)}
      </select>
      <label htmlFor="connection-target">Do kroku</label>
      <select id="connection-target" value={target} onChange={(event) => setTarget(event.target.value)} required>
        <option value="">Wybierz krok</option>{steps.map((step, index) => <option key={step.id} value={step.id}>{index + 1}. {step.name}</option>)}
      </select>
      <label htmlFor="connection-label">Kiedy następuje przejście?</label>
      <input id="connection-label" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} placeholder="np. Brak dokumentu — wróć do uzupełnienia" required />
      <button type="submit" className="back-button">Dodaj połączenie</button>
    </form>}
    {message && <p role="status">{message}</p>}
    {connections.length > 0 && <ul>{connections.map((link) => <li key={`${link.sourceId}-${link.index}`}>
      <span>{name(link.sourceId)} → {name(link.targetId)}: {link.label}</span>{' '}
      <button type="button" className="back-button" aria-label={`Usuń połączenie ${name(link.sourceId)} do ${name(link.targetId)}: ${link.label}`} onClick={() => {
        const result = onRemove(link.sourceId, link.index)
        setMessage(result?.error || `Usunięto połączenie. Zapisz proces ${variant}, aby zachować zmianę w bibliotece.`)
      }}>Usuń połączenie</button>
    </li>)}</ul>}
    {steps.length > 1 && <details>
      <summary>Przebieg podstawowy</summary>
      <p>Domyślnie proces przechodzi do następnego kroku z listy. Możesz wskazać inny krok, także powrót do wcześniejszego.</p>
      <label htmlFor="main-path-source">Po kroku</label>
      <select id="main-path-source" value={nextSourceStep?.id || ''} onChange={(event) => { setNextSource(event.target.value); setNextMessage('') }}>
        <option value="">Wybierz krok</option>{steps.map((step, index) => <option key={step.id} value={step.id}>{index + 1}. {step.name}</option>)}
      </select>
      <label htmlFor="main-path-target">Następny krok</label>
      <select id="main-path-target" disabled={!nextSourceStep} value={nextSourceStep?.nextStepId || ''} onChange={(event) => {
        const result = onSetNext(nextSourceStep.id, event.target.value)
        setNextMessage(result?.error || `Zapisano przejście. Zapisz proces ${variant}, aby zachować je w bibliotece.`)
      }}>
        <option value="">Według kolejności z listy</option>
        {steps.map((step, index) => step.id !== nextSource && <option key={step.id} value={step.id}>{index + 1}. {step.name}</option>)}
      </select>
      {nextMessage && <p role="status">{nextMessage}</p>}
      {overrides.length > 0 && <ul>{overrides.map((step) => <li key={step.id}>{step.name} → {name(step.nextStepId)}</li>)}</ul>}
    </details>}
  </section>
}
