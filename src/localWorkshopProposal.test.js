import { describe, expect, it } from 'vitest'
import { proposeLocalWorkshop } from './localWorkshopProposal'
import { validateWorkshopReview } from './workshop'

describe('local transcript suggestions', () => {
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
})
