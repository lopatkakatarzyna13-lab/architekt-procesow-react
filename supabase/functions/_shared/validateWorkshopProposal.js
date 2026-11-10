export function validateWorkshopProposal(proposal, transcript) {
  const errors = []
  if (typeof transcript !== 'string' || !transcript.trim()) return ['Brakuje transkrypcji.']
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return ['Nieprawidłowy format propozycji.']
  for (const category of ['steps', 'roles', 'decisions', 'questions']) {
    if (!Array.isArray(proposal[category])) { errors.push(`Brakuje listy: ${category}.`); continue }
    proposal[category].forEach((item, index) => {
      if (!item || typeof item.text !== 'string' || !item.text.trim()) { errors.push(`${category}[${index}]: brak treści.`); return }
      if (!['supported', 'assumption', 'question'].includes(item.status)) { errors.push(`${category}[${index}]: nieprawidłowy status.`); return }
      if (item.status === 'supported' && (typeof item.evidence !== 'string' || !item.evidence.trim() || !transcript.includes(item.evidence))) {
        errors.push(`${category}[${index}]: brak dokładnego fragmentu źródłowego.`)
      }
    })
  }
  return errors
}
