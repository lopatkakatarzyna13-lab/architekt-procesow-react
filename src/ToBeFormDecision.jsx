import { useState } from 'react'
import { formDecision } from './toBeBpmn.js'

export default function ToBeFormDecision({ steps, index, busy, onApply }) {
  const source = steps[index]
  const [chosenMain, setChosenMain] = useState(null)
  const [chosenReturn, setChosenReturn] = useState(null)
  const [error, setError] = useState('')
  const candidates = steps.filter((step) => step.id !== source.id)
  const forms = steps.slice(0, index).filter((step) => /formularz/iu.test(step.name))
  const mainId = chosenMain ?? source.nextStepId ?? steps[index + 1]?.id ?? ''
  const returnId = chosenReturn ?? (forms.length === 1 ? forms[0].id : '')
  const options = candidates.map((step) => <option key={step.id} value={step.id}>{step.name}</option>)
  const valid = mainId !== returnId && [mainId, returnId].every((id) => candidates.some((step) => step.id === id))

  return <section className="workshop-question-followup" aria-label={`Propozycja decyzji TO-BE — ${source.name}`}>
    <h3>{formDecision.question}</h3>
    <p>Po kroku „{source.name}” sprawdź oba cele i zatwierdź przebieg na mapie TO-BE.</p>
    <label>{formDecision.mainLabel}
      <select value={mainId} onChange={(event) => { setChosenMain(event.target.value); setError('') }}>
        <option value="">Wybierz następny krok</option>{options}
      </select>
    </label>
    <label>{formDecision.returnLabel}
      <select value={returnId} onChange={(event) => { setChosenReturn(event.target.value); setError('') }}>
        <option value="">Wybierz krok do poprawy</option>{options}
      </select>
    </label>
    <button type="button" className="save-button" disabled={busy || !valid}
      onClick={() => setError(onApply(source.id, mainId, returnId).error || '')}>
      Zatwierdź decyzję i powrót w TO-BE
    </button>
    {error && <p role="alert">{error}</p>}
  </section>
}
