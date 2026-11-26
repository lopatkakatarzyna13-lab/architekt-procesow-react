import { useImperativeHandle, useRef, useState } from 'react'
import { getBpmnMessages, getExternalPools } from './bpmnMessages.js'

export default function BpmnMessages({ steps, externalSteps = [], organizationName, onAdd, onRemove, onDraftChange, workshopRef, variant = 'AS-IS' }) {
  const [stepId, setStepId] = useState('')
  const [primaryDraft, setPrimaryDraft] = useState(null)
  const [external, setExternal] = useState('')
  const [direction, setDirection] = useState('')
  const [externalStepId, setExternalStepId] = useState('')
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState('')
  const list = getBpmnMessages(steps)
  const primaryDefault = list[0]?.primary || organizationName?.trim() || 'Organizacja'
  const primary = primaryDraft ?? primaryDefault
  const externalInput = useRef(null)
  const pools = getExternalPools(list)
  const dirty = Boolean(stepId || primaryDraft !== null || external || direction || label)
  useImperativeHandle(workshopRef, () => ({
    prepare(id, handoff) {
      if (dirty) return 'Najpierw dodaj lub wyczyść przygotowywaną wiadomość BPMN.'
      setStepId(id)
      setExternal(pools.find(([key]) => key === handoff.external.toLocaleLowerCase('pl'))?.[1] || handoff.external)
      setDirection(handoff.direction)
      setLabel(handoff.label)
      setExternalStepId('')
      setMessage('Sprawdź uczestników i kierunek przekazania. Wybierz „Dodaj wiadomość BPMN”, aby nanieść je na mapę.')
      onDraftChange('message-form', true)
      externalInput.current?.focus()
      return ''
    },
  }))
  const update = ({ primaryDraft, ...values }) => onDraftChange('message-form', primaryDraft !== null || Object.values(values).some(Boolean))
  const reset = () => { setStepId(''); setPrimaryDraft(null); setExternal(''); setDirection(''); setLabel(''); setExternalStepId(''); onDraftChange('message-form', false) }
  const submit = (event) => {
    event.preventDefault()
    const result = onAdd(stepId, primary, external, direction, label, externalStepId)
    if (result?.error) { setMessage(result.error); return }
    reset()
    setMessage(`Dodano wiadomość w wersji roboczej. Zapisz proces ${variant}.`)
  }
  if (!steps.length) return null
  return <section className="step-connections" aria-labelledby="bpmn-messages-title">
    <h2 id="bpmn-messages-title">Baseny i przekazanie wiadomości</h2>
    <p>Określ nazwę basenu swojego procesu, zewnętrznego uczestnika i krok wysyłający lub odbierający wiadomość. Dla każdego uczestnika użyj osobnej nazwy basenu. Możesz wskazać działanie w wybranym basenie. Nazwa własnego basenu musi być taka sama we wszystkich wiadomościach.</p>
    <form onSubmit={submit}>
      <label htmlFor="message-step">Krok w Twoim procesie</label>
      <select id="message-step" value={stepId} required onChange={(event) => { const v = event.target.value; setStepId(v); update({ stepId: v, primaryDraft, external, direction, label }) }}>
        <option value="">Wybierz krok</option>{steps.map((step, index) => <option key={step.id} value={step.id}>{index + 1}. {step.name}</option>)}
      </select>
      <label htmlFor="message-primary">Nazwa basenu Twojego procesu</label>
      <input id="message-primary" value={primary} maxLength={100} required placeholder="np. Firma" onChange={(event) => {
        const draft = event.target.value === primaryDefault ? null : event.target.value
        setPrimaryDraft(draft)
        update({ stepId, primaryDraft: draft, external, direction, label })
      }} />
      <label htmlFor="message-external">Nazwa basenu zewnętrznego</label>
      <input id="message-external" ref={externalInput} list={pools.length ? 'message-existing-pools' : undefined} value={external} maxLength={100} required placeholder="np. Biuro rachunkowe" onChange={(event) => { const v = event.target.value; setExternal(v); update({ stepId, primaryDraft, external: v, direction, label }) }} />
      {pools.length > 0 && <datalist id="message-existing-pools">{pools.map(([key, name]) => <option key={key} value={name} />)}</datalist>}
      <label htmlFor="message-direction">Kierunek wiadomości</label>
      <select id="message-direction" value={direction} required onChange={(event) => { const v = event.target.value; setDirection(v); update({ stepId, primaryDraft, external, direction: v, label }) }}>
        <option value="">Wybierz kierunek</option><option value="outgoing">Mój proces wysyła do zewnętrznego uczestnika</option><option value="incoming">Mój proces otrzymuje od zewnętrznego uczestnika</option>
      </select>
      {externalSteps.length > 0 && <><label htmlFor="message-external-step">Działanie uczestnika zewnętrznego (opcjonalnie)</label>
      <select id="message-external-step" value={externalStepId} onChange={(event) => setExternalStepId(event.target.value)}><option value="">Cały basen zewnętrzny</option>{externalSteps.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></>}
      <label htmlFor="message-label">Co jest przekazywane?</label>
      <input id="message-label" value={label} maxLength={100} required placeholder="np. Dane nowego pracownika" onChange={(event) => { const v = event.target.value; setLabel(v); update({ stepId, primaryDraft, external, direction, label: v }) }} />
      <div><button type="submit" className="back-button">Dodaj wiadomość BPMN</button>{' '}{dirty && <button type="button" className="back-button" onClick={() => { reset(); setMessage('Wyczyszczono formularz.') }}>Wyczyść formularz wiadomości</button>}</div>
    </form>
    {dirty && <p>Masz niezapisaną wiadomość. Dodaj ją albo wyczyść formularz przed zapisaniem procesu.</p>}
    {message && <p role="status">{message}</p>}
    {list.length > 0 && <ul>{list.map((item) => <li key={`${item.stepId}-${item.index}`}>
      <span>{steps.find((step) => step.id === item.stepId)?.name}: {item.direction === 'outgoing' ? item.primary : item.external} → {item.direction === 'outgoing' ? item.external : item.primary} — {item.label}{item.externalStepId ? ` (działanie zewnętrzne: ${externalSteps.find((step) => step.id === item.externalStepId)?.name || 'brak'})` : ''}</span>{' '}
      <button type="button" className="back-button" aria-label={`Usuń wiadomość ${item.label} — ${steps.find((step) => step.id === item.stepId)?.name}`} onClick={() => { const result = onRemove(item.stepId, item.index); setMessage(result?.error || `Usunięto wiadomość. Zapisz proces ${variant}.`) }}>Usuń wiadomość</button>
    </li>)}</ul>}
  </section>
}
