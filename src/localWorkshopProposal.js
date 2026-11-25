const numberedLine = /^\s*(?:\d+[.)]\s+|[-•]\s+)/
const speakerLabel = /^[\p{L}\d][\p{L}\d ._-]{0,39}:\s*/u
const timestamp = /^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/
const phaseLabel = /^(?:as[- ]is|to[- ]be)\s*[:–-]\s*/iu
const currentProcess = /^(?:as[- ]is\b|(?:obecnie|dzisiaj|w obecnym procesie|w procesie obecnym|teraz)\b)/iu
const futureProcess = /^(?:to[- ]be\b|(?:docelowo|w docelowym procesie|w procesie docelowym)\b|proponuj\p{L}*|(?:zapiszmy\s+)?(?:też\s+)?(?:propozycj\p{L}*|pomysł\p{L}*)\s+usprawnieni\p{L}*)/iu
const uncertain = /(?<!\p{L})(?:nie (?:wiem(?:y)?|wiadomo|znamy|pamiętam(?:y)?|ustalono|ustaliliśmy|ustaliłyśmy|mamy (?:jeszcze )?ustalon\p{L}*|ma (?:jeszcze )?(?:ustalon\p{L}*|procedury|zasad\p{L}*))|(?:trzeba|musimy) (?:to )?(?:ustalić|wyjaśnić|sprawdzić z)|nie (?:jest|jesteśmy) pewn\p{L}*)(?!\p{L})/iu
const followUpNote = /(?<!\p{L})do (?:ustalenia|wyjaśnienia|potwierdzenia)(?!\p{L})/iu
const hypothetical = /(?<!\p{L})(?:gdyby|można by|może|możemy|moglibyśmy|powin\p{L}*|warto|planuj\p{L}*|żeby|chciał\p{L}*)(?!\p{L})/iu
const condition = /^(?:jeśli|jeżeli|gdy|kiedy|w przypadku|przy braku|po otrzymaniu|po zatwierdzeniu|dopiero po)\b/iu
const trailingCondition = /,\s*((?:jeśli|jeżeli|gdy|kiedy|w przypadku|przy braku)\b.*)$/iu
const dependentClause = /^(?:czy|że|żeby|aby|bo|ponieważ|choć|chociaż|który|która|które|którego|jak|co|zanim|gdyby)\b/iu
const activitySeparator = /,\s*|\s+(?:i|oraz)\s+/giu
const negation = /(?:^|\s)nie\s+$/iu
const deadlineAction = /(?<!\p{L})(?:mam|ma|mają|mamy|masz|macie)\s+(?:(?:\d+|jeden|jedną|dwa|dwie|trzy|cztery|pięć|sześć|siedem|osiem|dziewięć|dziesięć|kilka|kilkanaście)\s+)?(?:minut\p{L}*|godzin\p{L}*|dni|dzień|tygodn\p{L}*|tydzień|miesiąc\p{L}*|miesięc\p{L}*|dob\p{L}*)(?:\s+(?:robocz\p{L}*|kalendarzow\p{L}*))?\s+na\s+\p{L}/iu
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

function findAction(text) {
  const verb = action.exec(text)
  const deadline = deadlineAction.exec(text)
  return deadline && (!verb || deadline.index < verb.index) ? deadline : verb
}

function splitActivities(text) {
  const activities = []
  let start = 0
  let sharedPrefix = ''
  for (const separator of text.matchAll(activitySeparator)) {
    const nextStart = separator.index + separator[0].length
    const tail = text.slice(nextStart)
    if (condition.test(tail) || dependentClause.test(tail)) break
    const following = findAction(tail.split(activitySeparator, 1)[0])
    if (!following) continue
    const current = text.slice(start, separator.index).trim()
    const verb = findAction(current)
    if (!verb) continue

    const prefix = current.slice(0, verb.index)
    const comma = separator[0].startsWith(',')
    const newSubject = roleName.test(tail.slice(0, following.index).trim())
    if (!comma && !newSubject && (following.index !== 0 || !(sharedPrefix || prefix) || negation.test(prefix))) continue
    activities.push(sharedPrefix + current)
    sharedPrefix = comma || newSubject ? '' : sharedPrefix || prefix
    start = nextStart
  }
  activities.push(sharedPrefix + text.slice(start))
  return activities
}

// Match grammatical roles in the action clause. A recipient or an anonymous
// speaker label is insufficient evidence for assigning responsibility.
const roleName = /^(?:kadry|HR|dział (?:kadr|HR|BHP|księgowości)|biuro(?: rachunkowe)?|księgowość|księgow[ay]|kierowni(?:k|czka)|menedżer(?:ka|owie)?|pracowni(?:k|ca)|specjalist(?:a|ka)(?: (?:do spraw|ds\.) (?:kadr|BHP|HR))?|właściciel(?:ka)?(?: procesu)?|koordynator(?:ka)?)$/iu
const contextPrefix = /^(?:(?:w (?:obecnym procesie|procesie obecnym)|do [\p{L}\d-]+ dnia miesiąca|po ponownej kontroli|po otrzymaniu uzupełnienia|obecnie|dzisiaj|teraz|potem|następnie|ponownie|czasem)\s+)+/iu
const invertedObject = /^(?:zgłoszenie|skierowanie|dane|zestawienie|formularz|dokument|odbiór)$/iu
const namedTool = /(?<![\p{L}\d])(?:SAP(?: (?:HR|HCM|FIORI))?|BPSC(?: ERP)?|Excel(?:u)?|SharePoint(?:cie)?|OTRS|KADROMIERZ|portal(?:u|em)? kadrow(?:y|ym)|rejestr(?:ze|em)? BHP)(?![\p{L}\d])/giu
// Also accept an explicitly named application outside the common aliases.
const explicitTool = /(?<!\p{L})(?:[Ww] (?:systemie|programie|aplikacji)|[Dd]o systemu|[Zz] systemu)\s+(?<name>[A-ZŁŚŻŹĆŃÓĘĄ][\p{L}\d-]*)(?=\s|[,.!?]|$)/gu
const toolContext = /(?:^|\s)(?:w|we|przez|za pomocą|przy użyciu|z|do)\s+(?:(?:systemie|systemu|systemem|system|aplikacji|programie|arkuszu|portalu|rejestrem)\s+)?$/iu

function stepDetails(activity, speakerRole) {
  const mainClause = (condition.test(activity) && activity.includes(',')
    ? activity.slice(activity.indexOf(',') + 1) : activity).trim()
  const clause = mainClause.split(/,\s*|\s+(?:bo|ponieważ|żeby|aby)\s+/iu)[0]
  const verb = findAction(clause)
  if (!verb) return { owner: '', system: '' }
  const before = clause.slice(0, verb.index).trim().replace(contextPrefix, '')
  const after = clause.slice(verb.index + verb[0].length).trim().replace(/[.!]+$/, '')
  let owner = ''
  if (roleName.test(before)) owner = before
  else if (invertedObject.test(before)) {
    const subject = after.split(/\s+(?:przez|w|do|na|za pomocą)\s+/iu)[0]
    if (roleName.test(subject)) owner = subject
  } else if ((!before || /^ja$/iu.test(before)) && /(?:am|amy|ę|emy|imy)$/iu.test(verb[0]) && roleName.test(speakerRole)) {
    owner = speakerRole
  }

  // Comma-separated alternatives can qualify the tool beyond the action clause.
  const alternative = /,\s*(?:a\s+)?(?:albo|lub|bądź|ewentualnie|czasem|czasami|niekiedy|może|chyba|jednak|raczej)\s+(.+)/iu.exec(mainClause)
  if (alternative) {
    return { owner: /^(?:w|we|przez)\s/iu.test(alternative[1]) ? owner : '', system: '' }
  }
  let system = ''
  const mentions = [...clause.matchAll(namedTool)].map((match) => ({ name: match[0], index: match.index }))
  for (const match of clause.matchAll(explicitTool)) {
    const name = match.groups.name
    const index = match.index + match[0].length - name.length
    if (!mentions.some((tool) => tool.index === index)) mentions.push({ name, index })
  }
  const uncertainTool = /(?<!\p{L})(?:lub|albo|bądź|czy|może|chyba|prawdopodobnie|nie|bez|zamiast|czasami|czasem)(?!\p{L})/iu
  const possibleActors = before.split(/\s+(?:lub|albo|bądź)\s+/iu)
  const toolClause = possibleActors.length > 1 && possibleActors.every((actor) => roleName.test(actor))
    ? after : clause
  if (mentions.length === 1 && !uncertainTool.test(toolClause)) {
    const { name, index } = mentions[0]
    const prefix = clause.slice(0, index)
    const isSubject = index === 0 && clause.slice(0, verb.index).trim() === name
    const following = clause.slice(index + name.length)
    if ((toolContext.test(prefix) || isSubject) && !/^\s+(?:i|oraz|[A-ZŁŚŻŹĆŃÓĘĄ][\p{L}\d-]*)\s/u.test(following + ' ')) {
      system = name.replace(/^portal(?:u|em) kadrowym$/iu, 'portal kadrowy')
        .replace(/^rejestr(?:ze|em) BHP$/iu, 'rejestr BHP').replace(/^Excelu$/iu, 'Excel').replace(/^SharePointcie$/iu, 'SharePoint')
    }
  }
  return { owner, system }
}

export function proposeLocalWorkshop(transcript) {
  const sentences = new Intl.Segmenter('pl', { granularity: 'sentence' })
  const proposal = { steps: [], exceptions: [], questions: [] }
  const seen = { steps: new Set(), exceptions: new Set(), questions: new Set() }
  const limits = { steps: maxSteps, exceptions: maxExceptions, questions: maxQuestions }
  const overflow = new Set()

  function add(category, text, evidence, details) {
    const key = text.toLocaleLowerCase('pl')
    if (seen[category].has(key)) {
      // Identical first-person wording can occur in turns by different roles.
      if (category === 'steps') {
        const previous = proposal.steps.find((step) => step.text.toLocaleLowerCase('pl') === key)
        if (previous.owner.toLocaleLowerCase('pl') !== details.owner.toLocaleLowerCase('pl')) previous.owner = ''
      }
      return
    }
    if (proposal[category].length >= limits[category]) {
      overflow.add(category)
      return
    }
    seen[category].add(key)
    proposal[category].push({ text, evidence, ...details, status: category === 'questions' ? 'question' : 'supported' })
  }

  let inFutureProcess = false
  let pendingQuestion = null
  for (const line of transcript.split(/\r\n?|\n/)) {
    const spoken = line.replace(numberedLine, '').trimStart()
    const utterance = spoken.replace(timestamp, '')
    const content = phaseLabel.test(utterance) ? utterance : utterance.replace(speakerLabel, '')
    const speaker = spoken.slice(0, spoken.length - content.length)
    const speakerRole = utterance.slice(0, utterance.length - content.length).replace(/:\s*$/, '').trim()
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

      if (uncertain.test(text) || (followUpNote.test(text) && !findAction(text))) {
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
      const verb = findAction(clause)
      if (conditional && !verb && /^dopiero po /iu.test(text)) {
        add('exceptions', text, evidence)
        pendingQuestion = null
      }
      if (!verb || hypothetical.test(text.slice(0, clauseStart + verb.index))) continue
      pendingQuestion = null

      const negated = negation.test(clause.slice(0, verb.index))
      if (negated || conditional) add('exceptions', text, evidence)
      if (negated) continue

      const activities = conditional ? [text] : splitActivities(text)
      const lastIndex = activities.length - 1
      const finalCondition = conditional ? null : trailingCondition.exec(activities[lastIndex])
      if (finalCondition) {
        add('exceptions', finalCondition[1], evidence)
        if (activities.length > 1) {
          activities[lastIndex] = activities[lastIndex].slice(0, finalCondition.index)
          const wording = finalCondition[1].replace(/[.!]+$/, '')
          add('questions', `Którego kroku dotyczy warunek „${wording}”?`, evidence)
        }
      }
      for (const activity of activities) {
        // Each suggestion retains the full original sentence as evidence.
        const activityVerb = findAction(activity)
        if (!activityVerb) continue
        const prefix = activity.slice(0, activityVerb.index)
        if (hypothetical.test(prefix)) continue
        if (!conditional && negation.test(prefix)) {
          add('exceptions', activity, evidence)
          continue
        }
        const name = activity[0].toLocaleUpperCase('pl') + activity.slice(1).replace(/[.!]+$/, '')
        const details = stepDetails(activity, speakerRole)
        const quote = index > 0 && details.owner && details.owner === speakerRole
          ? speaker + content.slice(0, index + segment.trimEnd().length) : evidence
        add('steps', name, quote, details)
      }
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
