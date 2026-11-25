import { useState } from 'react'
import { proposeWorkshopDecision } from './workshopDecision.js'

const routes = [
  ['sourceId', 'Po którym kroku zapada decyzja?'],
  ['mainId', 'Następny krok przy odpowiedzi twierdzącej'],
  ['otherId', 'Pierwszy krok przy brakach'],
  ['returnFrom', 'Z którego kroku sprawa wraca?'],
  ['returnTo', 'Do którego kroku wraca sprawa?'],
]

function DecisionReview({ proposal, steps, onApply }) {
  const [draft, setDraft] = useState(proposal)
  const [skipped, setSkipped] = useState(false)
  const [message, setMessage] = useState('')
  function edit(field, value) {
    setDraft((current) => ({ ...current, [field]: value, ...(['sourceId', 'returnFrom', 'returnTo'].includes(field) && { returnToDecision: false }) }))
    setMessage('')
  }
  if (skipped) return <button type="button" className="back-button" onClick={() => setSkipped(false)}>Wróć do pominiętej propozycji decyzji</button>
  return <section className="workshop-question-followup" aria-label="Propozycja decyzji AS-IS">
    <h3>Decyzja i powrót na mapie AS-IS</h3>
    {proposal.evidence.map((quote) => <blockquote key={quote}>Fragment rozmowy: {quote}</blockquote>)}
    <label>Pytanie na bramce
      <input value={draft.question} maxLength={120} onChange={(event) => edit('question', event.target.value)} />
    </label>
    {routes.map(([field, label]) => <label key={field}>{label}
      <select value={draft[field]} onChange={(event) => edit(field, event.target.value)}>
        <option value="">Do wyjaśnienia — wybierz krok</option>
        {steps.map((step) => <option key={step.id} value={step.id}>{step.name}</option>)}
      </select>
    </label>)}
    {draft.returnTo && draft.returnTo === draft.sourceId && <label>
      <input type="checkbox" checked={Boolean(draft.returnToDecision)} onChange={(event) => edit('returnToDecision', event.target.checked)} /> Po powrocie przejdź od razu do decyzji „{draft.question}”
    </label>}
    {[['mainLabel', 'Opis ścieżki podstawowej'], ['otherLabel', 'Opis ścieżki przy brakach']].map(([field, label]) =>
      <label key={field}>{label}
        <input value={draft[field]} maxLength={120} onChange={(event) => edit(field, event.target.value)} />
      </label>)}
    <div className="workshop-actions">
      <button type="button" className="save-button" disabled={routes.some(([field]) => !draft[field]) || ![draft.question, draft.mainLabel, draft.otherLabel].every((value) => value.trim())}
        onClick={() => setMessage(onApply(draft))}>Zatwierdź decyzję i powrót w AS-IS</button>
      <button type="button" className="back-button" onClick={() => setSkipped(true)}>Pomiń propozycję decyzji</button>
    </div>
    {message && <p role="status">{message}</p>}
  </section>
}

export default function WorkshopDecision({ analysis, steps, transcript, onApply }) {
  const proposal = proposeWorkshopDecision(analysis, steps, transcript)
  if (!proposal) return null
  return <DecisionReview key={JSON.stringify([proposal, steps.map(({ id, name }) => [id, name])])}
    proposal={proposal} steps={steps} onApply={onApply} />
}
