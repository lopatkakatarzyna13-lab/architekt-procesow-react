import { useMemo, useState } from 'react'
import { bpmnDocumentDirections, describeBpmnDocument, getBpmnDocuments } from './bpmnStepDetails.js'
import { proposeLocalWorkshop } from './localWorkshopProposal.js'
import { workshopDocumentProposals } from './workshopDocuments.js'
import { proposeDocumentHandoff } from './workshopHandoff.js'

function DocumentReview({ proposal, onApply, onPrepareHandoff }) {
  const { step, evidence, document, sourceKey } = proposal
  const [draft, setDraft] = useState(document)
  const [message, setMessage] = useState('')
  const saved = getBpmnDocuments(step).find((entry) => entry.workshopSource === sourceKey)
  const handoff = saved && proposeDocumentHandoff(proposal.activity, saved)
  const edit = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setMessage('')
  }
  return <fieldset>
    <legend>{step.name}</legend>
    <blockquote>Fragment rozmowy: {evidence}</blockquote>
    {saved ? <>
      <p role="status">Na mapie AS-IS · {bpmnDocumentDirections[saved.direction]} · {describeBpmnDocument(saved)}</p>
      {handoff && onPrepareHandoff && <button type="button" className="back-button" onClick={() => {
        setMessage(onPrepareHandoff(step.id, handoff) || '')
      }}>Przygotuj przekazanie do innego basenu</button>}
      {message && <p>{message}</p>}
    </> : <>
      <label>Kierunek dokumentu
        <select value={draft.direction} onChange={(event) => edit('direction', event.target.value)}>
          {Object.entries(bpmnDocumentDirections).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {[['name', 'Nazwa dokumentu'], ['format', 'Format'], ['channel', 'Kanał przekazania']].map(([field, label]) =>
        <label key={field}>{label}
          <input value={draft[field]} onChange={(event) => edit(field, event.target.value)} />
        </label>)}
      <button type="button" className="save-button" disabled={!draft.name.trim()}
        onClick={() => setMessage(onApply(step.id, draft, sourceKey))}>Zatwierdź dokument na mapie AS-IS</button>
      {message && <p role="status">{message}</p>}
    </>}
  </fieldset>
}

export default function WorkshopDocuments({ analysis, steps, transcript, onApply, onPrepareHandoff }) {
  const original = useMemo(() => proposeLocalWorkshop(transcript).steps, [transcript])
  const proposals = workshopDocumentProposals(analysis, steps, original)
  if (!proposals.length) return null
  return <section className="workshop-question-followup" aria-label="Dokumenty z transkrypcji">
    <h3>Dokumenty z transkrypcji</h3>
    <p>Sprawdź, czy krok otrzymuje dokument, czy przekazuje go dalej. Format i kanał możesz zostawić puste.</p>
    {proposals.map((proposal) => <DocumentReview key={JSON.stringify([proposal.step.id, proposal.evidence, proposal.sourceKey])} proposal={proposal} onApply={onApply} onPrepareHandoff={onPrepareHandoff} />)}
  </section>
}
