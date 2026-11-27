import { useState } from 'react'
import { getReusableAsIsDecisions } from './toBeBpmn.js'

export default function ToBeSourceDecision({ steps, asIsSteps, busy, onApply, onDraftChange }) {
  const [draft, setDraft] = useState(null)
  const [message, setMessage] = useState('')
  const proposals = getReusableAsIsDecisions(steps, asIsSteps)
  const selected = proposals.find(({ source }) => source.id === draft?.sourceId)
  const close = () => {
    setDraft(null)
    onDraftChange(false)
  }
  if (!proposals.length && !draft && !message) return null

  return <section className="step-connections" aria-labelledby="as-is-decision-title">
    <h2 id="as-is-decision-title">Decyzja z mapy AS-IS</h2>
    {!draft && proposals.map(({ source, step, branches }) => (
      <button key={source.id} type="button" className="back-button" disabled={busy} onClick={() => {
        setDraft({ sourceId: source.id, ...source.bpmnDecision, branchLabels: branches.map(({ label }) => label) })
        setMessage('')
        onDraftChange(true)
      }}>Użyj decyzji z AS-IS — {step.name}</button>
    ))}
    {draft && <>
      {selected ? <form onSubmit={(event) => {
        event.preventDefault()
        if (busy) return
        const result = onApply(draft.sourceId, draft)
        if (result?.error) { setMessage(result.error); return }
        close()
        setMessage('Dodano decyzję wraz ze ścieżkami. Zapisz proces TO-BE.')
      }}>
        <p>Decyzja po kroku „{selected.step.name}”. Sprawdź treść i cele ścieżek przed dodaniem.</p>
        <label>Pytanie z AS-IS
          <input required maxLength={120} value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} />
        </label>
        <label>Ścieżka podstawowa → {selected.source.nextIsDecision ? 'decyzja po kroku ' : ''}{selected.main?.name ?? 'koniec procesu'}
          <input required maxLength={120} value={draft.mainLabel} onChange={(event) => setDraft({ ...draft, mainLabel: event.target.value })} />
        </label>
        {selected.branches.map(({ target }, index) => <label key={index}>Ścieżka {index + 2} → {target.name}
          <input required maxLength={120} value={draft.branchLabels[index]} onChange={(event) => {
            const value = event.target.value
            setDraft({ ...draft, branchLabels: draft.branchLabels.map((label, i) => i === index ? value : label) })
          }} />
        </label>)}
        <button type="submit" className="back-button" disabled={busy}>Dodaj decyzję i ścieżki do TO-BE</button>
      </form> : <p>Sprawdź kroki i połączenia. Ta decyzja utraciła powiązanie z mapą TO-BE.</p>}
      <button type="button" className="back-button" onClick={() => { close(); setMessage('') }}>Anuluj użycie decyzji</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>
}
