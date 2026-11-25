import { useState } from 'react'
import { humanReview } from './toBeSuggestions'

export default function HumanReviewAction({ action, number, defaultOwner, busy, onApply }) {
  const [editedOwner, setEditedOwner] = useState(null)
  const owner = editedOwner ?? defaultOwner
  const reviewLabel = owner.trim().toLocaleLowerCase('pl') === 'kadry' ? 'kontrolę kadr' : 'kontrolę merytoryczną'
  return <div className="to-be-step-suggestion human-review-action">
    <strong>{action === 'replace' ? 'Propozycja zmiany' : 'Proponowany krok'} {number} · {humanReview.name}</strong>
    <label>Osoba lub rola wykonująca kontrolę
      <input value={owner} onChange={(event) => setEditedOwner(event.target.value)} />
    </label>
    <button type="button" className="copy-steps-button" disabled={busy || !owner.trim()} onClick={() => onApply(owner)}>
      {action === 'replace' ? 'Zamień powtórzoną walidację na ' : 'Dodaj '}{reviewLabel}
    </button>
  </div>
}
