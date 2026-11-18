import { useState } from 'react'
import { getBpmnMessages, getExternalPools } from './bpmnMessages'

export default function BpmnExternalMessages({ steps, links, onChange, onDraftChange, variant }) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState('')
  const pools = new Map(getExternalPools(getBpmnMessages(steps)))
  const dirty = Boolean(source || target || label)
  const reset = () => {
    setSource('')
    setTarget('')
    setLabel('')
    onDraftChange('external-messages-form', false)
  }
  const add = (event) => {
    event.preventDefault()
    const name = label.trim()
    if (!pools.has(source) || !pools.has(target) || source === target || !name) {
      setStatus('Wybierz dwa różne baseny i wpisz nazwę wiadomości.')
      return
    }
    if (links.some((link) => link.source === source && link.target === target && link.label.toLocaleLowerCase('pl') === name.toLocaleLowerCase('pl'))) {
      setStatus('To przekazanie już istnieje.')
      return
    }
    const result = onChange([...links, { source, target, label: name }])
    if (result?.error) { setStatus(result.error); return }
    reset()
    setStatus(`Dodano przekazanie. Zapisz proces ${variant}.`)
  }
  if (!steps.length) return null
  return <section className="step-connections" aria-labelledby="external-messages-title">
    <h2 id="external-messages-title">Przekazania między uczestnikami zewnętrznymi</h2>
    <p>Wybierz basen nadawcy i odbiorcy. Na liście są uczestnicy dodani w sekcji „Baseny i przekazanie wiadomości”.</p>
    {pools.size >= 2 && <form onSubmit={add}>
      <label htmlFor="external-message-source">Basen nadawcy</label>
      <select id="external-message-source" required value={pools.has(source) ? source : ''} onChange={(event) => {
        setSource(event.target.value)
        onDraftChange('external-messages-form', Boolean(event.target.value || target || label))
      }}>
        <option value="">Wybierz basen</option>
        {[...pools].map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
      <label htmlFor="external-message-target">Basen odbiorcy</label>
      <select id="external-message-target" required value={pools.has(target) ? target : ''} onChange={(event) => {
        setTarget(event.target.value)
        onDraftChange('external-messages-form', Boolean(source || event.target.value || label))
      }}>
        <option value="">Wybierz basen</option>
        {[...pools].map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
      <label htmlFor="external-message-name">Nazwa wiadomości między basenami</label>
      <input id="external-message-name" required maxLength={100} value={label} onChange={(event) => {
        setLabel(event.target.value)
        onDraftChange('external-messages-form', Boolean(source || target || event.target.value))
      }} />
      <button type="submit" className="back-button">Dodaj przekazanie między basenami</button>
    </form>}
    {dirty && <button type="button" className="back-button" onClick={reset}>Wyczyść przekazanie między basenami</button>}
    {links.length > 0 && <ul>{links.map((link, index) => <li key={JSON.stringify([link.source, link.target, link.label])}>
      {pools.get(link.source) || link.source} → {pools.get(link.target) || link.target} — {link.label}{' '}
      <button type="button" className="back-button" onClick={() => {
        const result = onChange(links.filter((_, i) => i !== index))
        setStatus(result?.error || `Usunięto przekazanie. Zapisz proces ${variant}.`)
      }}>Usuń przekazanie</button>
    </li>)}</ul>}
    {status && <p role="status">{status}</p>}
  </section>
}
