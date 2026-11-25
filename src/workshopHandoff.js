// Use the source activity of this document. A quote can include earlier sentences
// spoken by the same person, including a handoff for a different step.
const transfer = /(?<!\p{L})(wysył|przesył|przekazuj|odbier|otrzymuj)(?:am|amy|asz|a|ają|ą|ę|emy|e|esz)?(?!\p{L})/giu
const participants = [
  ['biura rachunkowego', 'Biuro rachunkowe'],
  ['poradni medycyny pracy', 'Poradnia medycyny pracy'],
  ['placówki medycyny pracy', 'Placówka medycyny pracy'],
  ['firmy kurierskiej', 'Firma kurierska'],
]

export function proposeDocumentHandoff(activity, document) {
  const clause = activity.replace(/^(?:gdy|jeżeli|jeśli|kiedy) [^,]+,\s*/iu, '')
  const matches = [...clause.matchAll(transfer)]
  if (matches.length !== 1) return null
  const verb = matches[0]
  const incoming = /^(?:odbier|otrzymuj)/iu.test(verb[1])
  if (document.direction !== (incoming ? 'input' : 'output')) return null
  const preposition = incoming ? 'od' : 'do'
  const tail = clause.slice(verb.index + verb[0].length)
  const mentioned = participants.filter(([phrase]) =>
    new RegExp('\\b' + preposition + ' ' + phrase + '(?=$|[.!]$| (?:e-mailem|mailem|przez portal|w formacie|na papierze|osobiście)\\b)', 'iu').test(tail))
  return {
    direction: incoming ? 'incoming' : 'outgoing',
    external: mentioned.length === 1 ? mentioned[0][1] : '',
    label: document.name,
  }
}
