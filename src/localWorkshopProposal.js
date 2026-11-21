const numberedLine = /^\s*(?:\d+[.)]\s+|[-•]\s+)/
const speakerLabel = /^[\p{L}\d][\p{L}\d ._-]{0,39}:\s*/u
const timestamp = /^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/
const phaseLabel = /^(?:as[- ]is|to[- ]be)\s*[:–-]\s*/iu
const currentProcess = /^(?:as[- ]is\b|(?:obecnie|dzisiaj|w obecnym procesie|teraz)\b)/iu
const futureProcess = /^(?:to[- ]be\b|docelowo\b|proponuj\p{L}*|(?:zapiszmy\s+)?(?:też\s+)?(?:propozycj\p{L}*|pomysł\p{L}*)\s+usprawnieni\p{L}*)/iu
const uncertain = /(?<!\p{L})(?:nie (?:wiem(?:y)?|wiadomo|znamy|pamiętam(?:y)?|ustalono|ustaliliśmy|ustaliłyśmy|mamy (?:jeszcze )?ustalon\p{L}*|ma (?:jeszcze )?(?:ustalon\p{L}*|procedury|zasad\p{L}*))|(?:trzeba|musimy) (?:to )?(?:ustalić|wyjaśnić|sprawdzić z)|nie (?:jest|jesteśmy) pewn\p{L}*)(?!\p{L})/iu
const followUpNote = /(?<!\p{L})do (?:ustalenia|wyjaśnienia|potwierdzenia)(?!\p{L})/iu
const hypothetical = /(?<!\p{L})(?:gdyby|można by|może|możemy|moglibyśmy|powin\p{L}*|warto|planuj\p{L}*|żeby|chciał\p{L}*)(?!\p{L})/iu
const condition = /^(?:jeśli|jeżeli|gdy|kiedy|w przypadku|przy braku|po otrzymaniu|po zatwierdzeniu|dopiero po)\b/iu
const action = new RegExp(String.raw`(?<!\p{L})(?:${[
  'wysył', 'przesył', 'sprawdz', 'zatwierdz', 'uzupełni', 'wypełni', 'rozpatruj', 'weryfikuj', 'generuj', 'przekazuj',
  'odsył', 'zwrac', 'wrac', 'zapisuj', 'wpisuj', 'dopisuj', 'wprowadz', 'rejestruj', 'potwierdz', 'informuj', 'otrzymuj',
  'pobier', 'porównuj', 'oczekuj', 'załącz', 'dołącz', 'przygotowuj', 'zbier', 'odbier', 'tworz', 'tworzy',
  'udostępni', 'wybier', 'prosz', 'prosi', 'czek', 'zlec', 'kieruj', 'przydziel', 'aktualizuj', 'archiwizuj',
  'podpisuj', 'drukuj', 'skanuj', 'wyznacz', 'odnotowuj', 'nalicz', 'przyjmuj', 'księguj',
  'publikuj', 'odrzuc', 'dostarcz', 'przypomin', 'zaznacz', 'zgłasz', 'podaj', 'poprawi', 'kontaktuj',
].join('|')})(?:a|ą|ają|am|amy|asz|e|ę|emy|ecie|esz|i|ią|imy|icie|isz|y|ysz)?(?!\p{L})`, 'iu')

const maxSteps = 30
const maxQuestions = 20
const maxExceptions = 20

function tidy(text) {
  return text.trim().replace(/\s+/g, ' ')
}

export function proposeLocalWorkshop(transcript) {
  const sentences = new Intl.Segmenter('pl', { granularity: 'sentence' })
  const proposal = { steps: [], exceptions: [], questions: [] }
  const seen = { steps: new Set(), exceptions: new Set(), questions: new Set() }
  const limits = { steps: maxSteps, exceptions: maxExceptions, questions: maxQuestions }
  const overflow = new Set()

  function add(category, text, evidence) {
    const key = text.toLocaleLowerCase('pl')
    if (seen[category].has(key)) return
    if (proposal[category].length >= limits[category]) {
      overflow.add(category)
      return
    }
    seen[category].add(key)
    proposal[category].push({ text, evidence, status: category === 'questions' ? 'question' : 'supported' })
  }

  let inFutureProcess = false
  let pendingQuestion = null
  for (const line of transcript.split(/\r\n?|\n/)) {
    const spoken = line.replace(numberedLine, '').trimStart()
    const utterance = spoken.replace(timestamp, '')
    const content = phaseLabel.test(utterance) ? utterance : utterance.replace(speakerLabel, '')
    const speaker = spoken.slice(0, spoken.length - content.length)
    for (const { segment, index } of sentences.segment(content)) {
      const raw = segment.trim()
      if (!raw) continue
      const evidence = index === 0 ? speaker + raw : raw
      const text = tidy(raw.replace(phaseLabel, ''))
      if (currentProcess.test(raw)) inFutureProcess = false
      else if (futureProcess.test(raw)) {
        inFutureProcess = true
        if (pendingQuestion) add('questions', pendingQuestion.text, pendingQuestion.evidence)
        pendingQuestion = null
      }

      if (uncertain.test(text) || (followUpNote.test(text) && !action.test(text))) {
        add('questions', pendingQuestion?.text ?? `Do wyjaśnienia — ${text}`, evidence)
        pendingQuestion = null
        continue
      }
      if (inFutureProcess || !text) continue
      if (text.endsWith('?')) {
        if (pendingQuestion) add('questions', pendingQuestion.text, pendingQuestion.evidence)
        pendingQuestion = { text, evidence }
        continue
      }
      const conditional = condition.test(text)
      const clauseStart = conditional ? text.indexOf(',') + 1 : 0
      const clause = text.slice(clauseStart)
      const verb = action.exec(clause)
      if (conditional && !verb && /^dopiero po /iu.test(text)) {
        add('exceptions', text, evidence)
        pendingQuestion = null
      }
      if (!verb || hypothetical.test(text.slice(0, clauseStart + verb.index))) continue
      pendingQuestion = null

      const negated = /(?:^|\s)nie\s+$/iu.test(clause.slice(0, verb.index))
      if (negated || conditional) add('exceptions', text, evidence)
      if (!negated) add('steps', text.replace(/[.!]+$/, ''), evidence)
    }
  }
  if (pendingQuestion) add('questions', pendingQuestion.text, pendingQuestion.evidence)
  if (overflow.size) {
    proposal.questions.push({
      text: 'Przejrzyj dalszą część rozmowy. Szkic pokazuje do 30 kroków, 20 wyjątków i 20 pytań.',
      evidence: '',
      status: 'question',
    })
  }
  if (!proposal.steps.length) {
    proposal.questions.unshift({
      text: 'Sprawdź, kto wykonuje poszczególne czynności i w jakiej kolejności. Reguły nie rozpoznały kroków AS-IS w tym tekście.',
      evidence: '',
      status: 'question',
    })
  }
  return proposal
}
