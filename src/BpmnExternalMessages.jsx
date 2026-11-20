import { useState } from 'react'
import { getBpmnMessages, getExternalActionPool, getExternalPools } from './bpmnMessages.js'

export default function BpmnExternalMessages({ steps, externalSteps, links, onChange, onDraftChange, variant }) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [sourceActionId, setSourceActionId] = useState('')
  const [targetActionId, setTargetActionId] = useState('')
  const [label, setLabel] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [status, setStatus] = useState('')
  const messages = getBpmnMessages(steps)
  const poolEntries = getExternalPools(messages)
  const pools = new Map(poolEntries)
  const actionsIn = (pool) => externalSteps.filter((action) => pool && getExternalActionPool(action, messages, poolEntries) === pool)
  const actionName = (id) => externalSteps.find((action) => action.id === id)?.name
  const formatEndpoint = (pool, id) => [pools.get(pool) ?? pool, actionName(id)].filter(Boolean).join(' / ')
  const editing = editingIndex !== null
  const dirty = editing || Boolean(source || target || label)
  const reset = () => {
    setEditingIndex(null)
    setSource('')
    setTarget('')
    setSourceActionId('')
    setTargetActionId('')
    setLabel('')
    onDraftChange('external-messages-form', false)
  }
  const edit = (link, index) => {
    setEditingIndex(index)
    setSource(link.source)
    setTarget(link.target)
    setSourceActionId(link.sourceActionId ?? '')
    setTargetActionId(link.targetActionId ?? '')
    setLabel(link.label)
    setStatus('')
    onDraftChange('external-messages-form', true)
  }
  const save = (event) => {
    event.preventDefault()
    const name = label.trim()
    if (!pools.has(source) || !pools.has(target) || source === target || !name) {
      setStatus('Wybierz dwa różne baseny i wpisz nazwę wiadomości.')
      return
    }
    if ((sourceActionId && !actionsIn(source).some(({ id }) => id === sourceActionId)) ||
        (targetActionId && !actionsIn(target).some(({ id }) => id === targetActionId))) {
      setStatus('Wybierz działanie z właściwego basenu lub wskaż cały basen.')
      return
    }
    const duplicate = links.some((link, index) =>
      index !== editingIndex && link.source === source && link.target === target &&
      (link.sourceActionId ?? '') === sourceActionId && (link.targetActionId ?? '') === targetActionId &&
      link.label.trim().toLocaleLowerCase('pl') === name.toLocaleLowerCase('pl'),
    )
    if (duplicate) {
      setStatus('To przekazanie już istnieje.')
      return
    }
    const nextLink = { source, target, label: name }
    if (sourceActionId) nextLink.sourceActionId = sourceActionId
    if (targetActionId) nextLink.targetActionId = targetActionId
    const nextLinks = editing ? links.map((link, index) => index === editingIndex ? nextLink : link) : [...links, nextLink]
    const result = onChange(nextLinks)
    if (result?.error) { setStatus(result.error); return }
    reset()
    const confirmation = editing ? 'Zmieniono przekazanie.' : 'Dodano przekazanie.'
    setStatus(`${confirmation} Zapisz proces ${variant}.`)
  }
  if (!steps.length) return null
  return <section className="step-connections" aria-labelledby="external-messages-title">
    <h2 id="external-messages-title">Przekazania między uczestnikami zewnętrznymi</h2>
    <p>Wybierz basen nadawcy i odbiorcy. W każdym z nich możesz wskazać konkretne działanie. Na liście są uczestnicy dodani w sekcji „Baseny i przekazanie wiadomości”.</p>
    {pools.size >= 2 && <form onSubmit={save}>
      <label htmlFor="external-message-source">Basen nadawcy</label>
      <select id="external-message-source" required value={pools.has(source) ? source : ''} onChange={(event) => {
        setSource(event.target.value)
        setSourceActionId('')
        onDraftChange('external-messages-form', editing || Boolean(event.target.value || target || label))
      }}>
        <option value="">Wybierz basen</option>
        {[...pools].map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
      {pools.has(source) && <>
        <label htmlFor="external-message-source-action">Działanie nadawcy</label>
        <select id="external-message-source-action" value={sourceActionId} onChange={(event) => setSourceActionId(event.target.value)}>
          <option value="">Cały basen</option>
          {actionsIn(source).map((action) => <option key={action.id} value={action.id}>{action.name}</option>)}
        </select>
      </>}
      <label htmlFor="external-message-target">Basen odbiorcy</label>
      <select id="external-message-target" required value={pools.has(target) ? target : ''} onChange={(event) => {
        setTarget(event.target.value)
        setTargetActionId('')
        onDraftChange('external-messages-form', editing || Boolean(source || event.target.value || label))
      }}>
        <option value="">Wybierz basen</option>
        {[...pools].map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
      {pools.has(target) && <>
        <label htmlFor="external-message-target-action">Działanie odbiorcy</label>
        <select id="external-message-target-action" value={targetActionId} onChange={(event) => setTargetActionId(event.target.value)}>
          <option value="">Cały basen</option>
          {actionsIn(target).map((action) => <option key={action.id} value={action.id}>{action.name}</option>)}
        </select>
      </>}
      <label htmlFor="external-message-name">Nazwa wiadomości między basenami</label>
      <input id="external-message-name" required maxLength={100} value={label} onChange={(event) => {
        setLabel(event.target.value)
        onDraftChange('external-messages-form', editing || Boolean(source || target || event.target.value))
      }} />
      <button type="submit" className="back-button">{editing ? 'Zapisz zmiany przekazania' : 'Dodaj przekazanie między basenami'}</button>
    </form>}
    {dirty && <button type="button" className="back-button" onClick={() => { reset(); setStatus('') }}>{editing ? 'Anuluj edycję przekazania' : 'Wyczyść przekazanie między basenami'}</button>}
    {links.length > 0 && <ul>{links.map((link, index) => <li key={JSON.stringify([link.source, link.target, link.sourceActionId, link.targetActionId, link.label])}>
      {formatEndpoint(link.source, link.sourceActionId)} → {formatEndpoint(link.target, link.targetActionId)} — {link.label}{' '}
      <button type="button" className="back-button" disabled={dirty || pools.size < 2} onClick={() => edit(link, index)}>Edytuj przekazanie</button>{' '}
      <button type="button" className="back-button" disabled={dirty} onClick={() => {
        const result = onChange(links.filter((_, i) => i !== index))
        setStatus(result?.error || `Usunięto przekazanie. Zapisz proces ${variant}.`)
      }}>Usuń przekazanie</button>
    </li>)}</ul>}
    {status && <p role="status">{status}</p>}
  </section>
}
