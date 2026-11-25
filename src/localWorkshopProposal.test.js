import { describe, expect, it } from 'vitest'
import { proposeLocalWorkshop } from './localWorkshopProposal'
import { validateWorkshopReview } from './workshop'

describe('local transcript suggestions', () => {
  it('keeps the comparison criteria and the exact supporting exchange from one utterance', () => {
    const text = 'HR: Specjalistka do spraw kadr porównuje kartę z rejestrem BHP.  Sprawdza datę wersji i zgodność z nazwą stanowiska.'
    const { steps } = proposeLocalWorkshop(text)
    expect(steps[0].description).toBe('Sprawdza datę wersji i zgodność z nazwą stanowiska.')
    expect(steps[0].evidence).toBe(text)
  })

  it('does not assign a detail from another speaker, an alternative, or a shared condition', () => {
    const { steps } = proposeLocalWorkshop([
      'HR: Specjalistka porównuje kartę z rejestrem BHP.',
      'Biuro: Sprawdza datę wersji.',
      'Kadry wysyłają skierowanie przez formularz lub przez pocztę.',
      'Kadry wysyłają skierowanie mailem, nie przez formularz.',
      'Kierownik wysyła zgłoszenie, kadry sprawdzają dane, jeśli czegoś brakuje.',
    ].join('\n'))
    expect(steps.every((step) => step.description === '')).toBe(true)
  })

  it('places details only on the action that supplies them', () => {
    const { steps } = proposeLocalWorkshop('Kadry wysyłają dane o premiach, biuro potwierdza odbiór. Kierownik uzupełnia kartę w ciągu dwóch dni roboczych.')
    expect(steps.map((step) => step.description)).toEqual(['Dane o premiach.', '', 'W ciągu dwóch dni roboczych.'])
  })
  it('splits the actions from the short referral recording and retains its deadline and unclear condition', () => {
    const firstSentence = 'Kierownik wysyła zgłoszenie, kadry sprawdzają kompletność danych, jeśli czegoś brakuje.'
    const deadline = 'Kierownik ma dwa dni robocze na uzupełnienie zgłoszenia.'
    const lastSentence = 'Po ponownej kontroli kadry zatwierdzają dane i generują skierowanie.'
    const transcript = `${firstSentence} ${deadline}\n${lastSentence}`
    const proposal = { roles: [], systems: [], decisions: [], ...proposeLocalWorkshop(transcript) }

    expect(validateWorkshopReview(proposal, transcript)).toEqual([])
    expect(proposal.steps.map(({ text, evidence }) => [text, evidence])).toEqual([
      ['Kierownik wysyła zgłoszenie', firstSentence],
      ['Kadry sprawdzają kompletność danych', firstSentence],
      ['Kierownik ma dwa dni robocze na uzupełnienie zgłoszenia', deadline],
      ['Po ponownej kontroli kadry zatwierdzają dane', lastSentence],
      ['Po ponownej kontroli kadry generują skierowanie', lastSentence],
    ])
    expect(proposal.exceptions).toEqual([{ text: 'jeśli czegoś brakuje.', evidence: firstSentence, status: 'supported' }])
    expect(proposal.questions).toEqual([{
      text: 'Którego kroku dotyczy warunek „jeśli czegoś brakuje”?',
      evidence: firstSentence,
      status: 'question',
    }])
  })

  it('keeps the object of a check and the clear condition for a single action', () => {
    const transcript = 'Kadry sprawdzają, czy kierownik wysyła formularz i dołącza kartę. Kadry wysyłają przypomnienie, jeśli brakuje potwierdzenia.'
    const { steps, exceptions, questions } = proposeLocalWorkshop(transcript)
    expect(steps.map(({ text }) => text)).toEqual([
      'Kadry sprawdzają, czy kierownik wysyła formularz i dołącza kartę',
      'Kadry wysyłają przypomnienie, jeśli brakuje potwierdzenia',
    ])
    expect(exceptions.map(({ text }) => text)).toEqual(['jeśli brakuje potwierdzenia.'])
    expect(questions).toEqual([])
  })

  it('retains exact evidence with Polish speaker labels and identifies conditional work', () => {
    const transcript = [
      '1. [00:12] HR: Kadry sprawdzają dane. Kierownik dopisuje stanowisko.',
      '2. HR: Jeżeli kierownik nie potwierdzi zgłoszenia, kadry wysyłają przypomnienie.',
      '3. HR: Jeśli kadry nie zatwierdzą danych, system nie generuje PDF.',
      '4. HR: Dopiero po zatwierdzeniu przez kadry.',
    ].join('\r\n')
    const proposal = { roles: [], systems: [], decisions: [], ...proposeLocalWorkshop(transcript) }
    expect(validateWorkshopReview(proposal, transcript)).toEqual([])
    expect(proposal.steps.map(({ text }) => text)).toEqual([
      'Kadry sprawdzają dane',
      'Kierownik dopisuje stanowisko',
      'Jeżeli kierownik nie potwierdzi zgłoszenia, kadry wysyłają przypomnienie',
    ])
    expect(proposal.steps[0].evidence).toBe('[00:12] HR: Kadry sprawdzają dane.')
    expect(proposal.exceptions.map(({ text }) => text)).toEqual([
      'Jeżeli kierownik nie potwierdzi zgłoszenia, kadry wysyłają przypomnienie.',
      'Jeśli kadry nie zatwierdzą danych, system nie generuje PDF.',
      'Dopiero po zatwierdzeniu przez kadry.',
    ])
  })

  it('leaves open questions and skips the proposed future process until the current process resumes', () => {
    const transcript = [
      'Prowadząca: Kto zatwierdza wydatki?',
      'Biuro: Nie wiemy, musimy to ustalić.',
      'TO-BE: System przypomina o terminie.',
      'Portal generuje potwierdzenie.',
      'AS-IS: Pracownik podpisuje formularz.',
      'Prowadząca: Kto odbiera oryginał?',
    ].join('\n')
    const { steps, questions } = proposeLocalWorkshop(transcript)
    expect(steps.map(({ text }) => text)).toEqual(['Pracownik podpisuje formularz'])
    expect(questions).toEqual([
      { text: 'Kto zatwierdza wydatki?', evidence: 'Biuro: Nie wiemy, musimy to ustalić.', status: 'question' },
      { text: 'Kto odbiera oryginał?', evidence: 'Prowadząca: Kto odbiera oryginał?', status: 'question' },
    ])
  })

  it('recognizes spoken transitions between the current and target process', () => {
    const transcript = [
      'Kierownik wysyła zgłoszenie mailem.',
      'W docelowym procesie formularz sprawdzi pola obowiązkowe.',
      'Rejestr BHP udostępni aktualną kartę stanowiska.',
      'Nie znamy miesięcznej liczby zgłoszeń.',
      'W procesie obecnym kadry odbierają wiadomość.',
      'W procesie docelowym system generuje przypomnienie.',
      'W obecnym procesie kadry zatwierdzają dane.',
    ].join('\n')
    const { steps, questions } = proposeLocalWorkshop(transcript)
    expect(steps.map(({ text }) => text)).toEqual([
      'Kierownik wysyła zgłoszenie mailem',
      'W procesie obecnym kadry odbierają wiadomość',
      'W obecnym procesie kadry zatwierdzają dane',
    ])
    expect(questions.map(({ text }) => text)).toEqual(['Do wyjaśnienia — Nie znamy miesięcznej liczby zgłoszeń.'])
  })

  it('reports when no action was recognized instead of turning questions into steps', () => {
    const { steps, questions } = proposeLocalWorkshop('Może kadry wysyłają dokument. Czy pracownik potwierdza odbiór?')
    expect(steps).toEqual([])
    expect(questions.map(({ text }) => text)).toEqual([
      expect.stringContaining('Reguły nie rozpoznały kroków AS-IS'),
      'Czy pracownik potwierdza odbiór?',
    ])
  })

  it('distinguishes a confirmation task from a note about missing details', () => {
    const { steps, questions } = proposeLocalWorkshop('HR przekazuje formularz do potwierdzenia. Termin odbioru do ustalenia.')
    expect(steps.map(({ text }) => text)).toEqual(['HR przekazuje formularz do potwierdzenia'])
    expect(questions.map(({ text }) => text)).toEqual(['Do wyjaśnienia — Termin odbioru do ustalenia.'])
  })

  it('binds each role and system to its own action and quotes the original sentence', () => {
    const text = 'Kierownik zapisuje dane w SAP HR i kadry sprawdzają dane w systemie Enova.'
    const { steps } = proposeLocalWorkshop(text)
    expect(steps.map(({ owner, system, evidence }) => [owner, system, evidence])).toEqual([
      ['Kierownik', 'SAP HR', text], ['kadry', 'Enova', text],
    ])
  })

  it('distinguishes a role speaking in the first person from a recipient, condition or anonymous speaker', () => {
    const text = [
      'HR: Zbieram dane. Gdy kierownik dostarczy plik, przekazuję go do biura przez uzgodniony kanał.',
      'Głos A: Przekazuję zgłoszenie do kadr w portalu kadrowym.',
      'Kadry lub kierownik sprawdzają dane w SAP albo w Excelu.',
      'Kadry sprawdzają, czy kierownik wysyła dokument przez portal kadrowy.',
    ].join('\n')
    const { steps } = proposeLocalWorkshop(text)
    expect(steps.map(({ owner, system }) => [owner, system])).toEqual([
      ['HR', ''], ['HR', ''], ['', 'portal kadrowy'], ['', ''], ['Kadry', ''],
    ])
    expect(steps[1].evidence).toMatch(/^HR:.*przekazuję/)
    for (const step of steps) expect(text).toContain(step.evidence)
  })

  it('deduplicates with Polish casing and shows when proposal limits are exceeded', () => {
    const transcript = [
      'MENEDŻER wysyła zgłoszenie.',
      'Menedżer wysyła zgłoszenie.',
      ...Array.from({ length: 31 }, (_, index) => `Kadry weryfikują zgłoszenie o numerze ${index}.`),
    ].join('\n')
    const { steps, questions } = proposeLocalWorkshop(transcript)
    expect(steps).toHaveLength(30)
    expect(steps[1].text).toBe('Kadry weryfikują zgłoszenie o numerze 0')
    expect(questions.at(-1).text).toContain('do 30 kroków')
  })

  it.each([
    ['Kierownik ma dwa dni robocze na uzupełnienie zgłoszenia.', 'dwa dni robocze'],
    ['HR wysyła raport w ciągu 24 godzin od otrzymania zgłoszenia.', 'w ciągu 24 godzin od otrzymania zgłoszenia'],
    ['Do piątego dnia miesiąca menedżerowie wysyłają HR dane o premiach.', 'Do piątego dnia miesiąca'],
    ['Kadry zatwierdzają zestawienie do ostatniego dnia roboczego miesiąca.', 'do ostatniego dnia roboczego miesiąca'],
  ])('proponuje termin przypisany do pojedynczej czynności: %s', (text, deadline) => {
    const [step] = proposeLocalWorkshop(text).steps
    expect(step.bpmnDeadline).toBe(deadline)
    expect(step.evidence).toContain(deadline)
  })

  it.each([
    'HR czeka na odpowiedź w ciągu dwóch dni roboczych.',
    'Jeżeli kierownik nie odpowie w ciągu dwóch dni roboczych, kadry wysyłają przypomnienie.',
    'Kierownik zwykle uzupełnia dane w ciągu dwóch dni.',
    'Kadry sprawdzają dane przez dwie godziny.',
    'Kierownik uzupełnia dane w ciągu dwóch dni albo do końca miesiąca.',
    'Kadry zatwierdzają dane i wysyłają raport w ciągu dwóch dni.',
    'HR sprawdza kompletność dokumentów. Dwa dni później kadry wysyłają raport.',
  ])('nie zamienia obserwacji, oczekiwania ani niejednoznacznego warunku w termin: %s', (text) => {
    expect(proposeLocalWorkshop(text).steps.every((step) => step.bpmnDeadline === undefined)).toBe(true)
  })

  it('keeps conflicting speakers and alternative tools open for confirmation', () => {
    const transcript = 'HR: Wysyłam plik w SAP.\nBiuro: Wysyłam plik w SAP.\nKadry sprawdzają dane w SAP, czasem w Excelu.'
    const { steps } = proposeLocalWorkshop(transcript)
    expect(steps.map(({ owner, system }) => [owner, system])).toEqual([['', 'SAP'], ['Kadry', '']])
  })
})
