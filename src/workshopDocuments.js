import { getBpmnDocuments, getBpmnStepError } from './bpmnStepDetails.js'

const normalize = (text) => text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pl')
const action = /(?<!\p{L})(odbier|otrzymuj|pobier|wysył|przesył|przekazuj|generuj|przygotowuj|tworz)(?:am|amy|asz|a|ają|ą|ę|emy|e|esz|y|ymy|ysz)?(?!\p{L})/giu
const object = /^(skierowanie(?: na badania(?: wstępne| okresowe| kontrolne)?)?|zestawienie(?: nieobecności| premii| czasu pracy| danych)?|formularz(?: zgłoszeniowy| zgłoszenia)?|wniosek(?: urlopowy| o urlop)?|zgłoszenie(?: pracownika)?|potwierdzenie(?: odbioru)?|dokument|raport|protokół)(?!\p{L})/iu
const formats = [
  ...['PDF', 'XLSX', 'CSV', 'DOCX'].map((ext) => [new RegExp('(?:^\\s*|\\b(?:w formacie|jako plik|w pliku)\\s+)' + ext + '\\b', 'iu'), ext]),
  [/(?:na papierze|w (?:formie|wersji) papierowej)/iu, 'papier'],
  [/(?:w (?:formie|postaci) skanu|jako skan)/iu, 'skan'],
]
const channels = [
  [/(?<!\p{L})(?:e-?mailem|mailem|pocztą elektroniczną|przez e-?mail)(?!\p{L})/iu, 'e-mail'],
  [/(?:przez portal|za pośrednictwem portalu)(?!\p{L})/iu, 'portal'],
  [/(?<!\p{L})osobiście(?!\p{L})/iu, 'osobiście'],
]

function singleValue(rules, text) {
  const matches = rules.filter(([pattern]) => pattern.test(text))
  return matches.length === 1 ? matches[0][1] : ''
}

export function documentFromActivity(text) {
  const clause = text.replace(/^(?:gdy|jeżeli|jeśli|kiedy) [^,]+,\s*/iu, '')
  if (/[?]|(?<!\p{L})(?:nie|bez|zamiast|może|planuje|powinien|gdyby)(?!\p{L})/iu.test(clause)) return null
  const verbs = [...clause.matchAll(action)]
  if (verbs.length !== 1) return null
  const verb = verbs[0]
  const after = clause.slice(verb.index + verb[0].length).trim()
  const match = object.exec(after)
  if (!match) return null
  const tail = after.slice(match[0].length)
  if (/(?:\s(?:oraz|i|lub|albo|który|która|które|którego|zawierający)\s|[,;])/iu.test(tail)) return null
  return {
    direction: /^(?:odbier|otrzymuj|pobier)/iu.test(verb[1]) ? 'input' : 'output',
    name: match[0][0].toLocaleUpperCase('pl') + match[0].slice(1),
    format: singleValue(formats, tail),
    channel: singleValue(channels, tail),
  }
}

export function workshopDocumentProposals(analysis, steps, original) {
  if (analysis?.source !== 'local-transcript') return []
  const proposals = []
  for (const item of analysis.steps) {
    if (!item.reviewed || !item.evidence) continue
    const sources = original.filter((source) => source.evidence === item.evidence)
    const source = sources.length === 1 ? sources[0] : sources.find((entry) => entry.text === item.text)
    if (!source) continue
    const document = documentFromActivity(source.text)
    if (!document) continue
    const matches = steps.filter((step) => normalize(step.name) === normalize(item.text))
    if (matches.length === 1) proposals.push({ step: matches[0], activity: source.text, evidence: item.evidence, document, sourceKey: document.direction + ':' + normalize(document.name) })
  }
  return proposals
}

export function applyWorkshopDocument(steps, stepId, draft, sourceKey) {
  const step = steps.find((item) => item.id === stepId)
  if (!step) throw new Error('Krok AS-IS już nie istnieje.')
  const document = { direction: draft.direction, name: draft.name.trim(), format: draft.format.trim(), channel: draft.channel.trim() }
  const error = getBpmnStepError({ bpmnDocuments: [document] }) || getBpmnStepError(step)
  if (error) throw new Error(error)
  const documents = getBpmnDocuments(step)
  const existing = documents.filter((item) => (sourceKey && item.workshopSource === sourceKey) ||
    (item.direction === document.direction && normalize(item.name) === normalize(document.name)))
  const exact = existing.find((item) => item.direction === document.direction && normalize(item.name) === normalize(document.name) &&
    normalize(item.format ?? '') === normalize(document.format) && normalize(item.channel ?? '') === normalize(document.channel))
  if (exact && exact.workshopSource === sourceKey) return steps
  if (existing.length && (!exact || existing.length > 1 || exact.workshopSource)) throw new Error('Ten dokument ma już inne szczegóły. Sprawdź go w edycji kroku.')
  const next = exact
    ? documents.map((item) => item === exact ? { ...item, workshopSource: sourceKey } : item)
    : [...documents, { ...document, workshopSource: sourceKey }]
  return steps.map((item) => item === step ? { ...step, bpmnDocuments: next } : item)
}
