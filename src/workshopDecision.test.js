import { describe, expect, it } from 'vitest'
import { BpmnModdle } from 'bpmn-moddle'
import { createDecisionBpmn } from './bpmnDecisionExport'
import { proposeLocalWorkshop } from './localWorkshopProposal'
import { appendWorkshopSteps } from './workshop'
import { applyWorkshopDecision, proposeWorkshopDecision } from './workshopDecision'

const transcripts = [
  'Kadry sprawdzają kompletność zgłoszenia. Jeżeli brakuje danych, kierownik uzupełnia formularz. Zgłoszenie wraca do kadr do ponownej kontroli. Gdy dane są kompletne, kadry zatwierdzają skierowanie.',
  'HR: Sprawdzam, czy dane są kompletne. Zwracam zestawienie menedżerowi z prośbą o uzupełnienie. Po otrzymaniu uzupełnienia ponownie sprawdzam kompletność. Gdy dane są kompletne, przekazuję zestawienie do biura.',
]

function fixture(transcript) {
  const analysis = { ...proposeLocalWorkshop(transcript), source: 'local-transcript' }
  analysis.steps.forEach((item) => { item.reviewed = true })
  let count = 0
  const { steps } = appendWorkshopSteps([], analysis.steps.map(({ text }) => ({ name: text })), () => String(++count))
  return { analysis, steps, proposal: proposeWorkshopDecision(analysis, steps, transcript) }
}

describe('decyzja z lokalnego warsztatu', () => {
  it.each(transcripts)('łączy zatwierdzone kroki i eksportuje bramkę oraz powrót: %s', async (transcript) => {
    const { steps, proposal } = fixture(transcript)
    expect(proposal).toMatchObject({ sourceId: '1', otherId: '2', returnFrom: '3', returnTo: '1', mainId: '4' })
    expect(proposal.evidence.every((quote) => transcript.includes(quote))).toBe(true)
    const next = applyWorkshopDecision(steps, proposal)
    expect(applyWorkshopDecision(next, proposal)).toBe(next)
    const { rootElement, warnings } = await new BpmnModdle().fromXML(await createDecisionBpmn({ steps: next }))
    expect(warnings).toEqual([])
    const node = (id) => rootElement.rootElements[0].flowElements.find((element) => element.id === id)
    expect(node('Decision_1').outgoing.map((flow) => [flow.name, flow.targetRef.id])).toEqual([['Tak', 'Task_4'], ['Nie', 'Task_2']])
    expect(node('Task_3').outgoing[0].targetRef.outgoing[0].targetRef.id).toBe('Task_1')
  })

  it('pozostawia cel niejasnego powrotu do wskazania', () => {
    const text = transcripts[0].replace('do kadr do ponownej kontroli', 'do zespołu')
    const { steps, proposal } = fixture(text)
    expect(proposal.returnTo).toBe('')
    expect(() => applyWorkshopDecision(steps, proposal)).toThrow(/cel powrotu/)
    expect(applyWorkshopDecision(steps, { ...proposal, returnTo: '1' })[2].nextStepId).toBe('1')
  })

  it('chroni istniejące połączenia i odrzuca nieosiągalny przebieg', () => {
    const { steps, proposal } = fixture(transcripts[0])
    const manual = steps.map((step, i) => i ? step : { ...step, nextStepId: '2' })
    expect(() => applyWorkshopDecision(manual, proposal)).toThrow(/koliduje/)
    expect(manual[0].extraConnections).toBeUndefined()
    expect(() => applyWorkshopDecision(steps, { ...proposal, returnFrom: '2' })).toThrow(/ścieżkę/)
  })

  it('pyta o cel, kiedy w rozmowie pada tylko „sprawa wraca”', () => {
    const { proposal } = fixture('HR sprawdza kompletność danych. Jeżeli czegoś brakuje, sprawa wraca. Gdy dane są kompletne, HR przekazuje dane do biura.')
    expect(proposal).toMatchObject({ otherId: '2', returnFrom: '2', returnTo: '', mainId: '3' })
  })

  it('nie traktuje zanegowanego warunku kompletności jako zgody na kontynuację', () => {
    const text = transcripts[0].replace('Jeżeli brakuje danych', 'Jeżeli dane nie są kompletne')
    expect(fixture(text).proposal.mainId).toBe('4')
  })

  it('nie przypisuje niezatwierdzonego lub nieprzeniesionego kroku', () => {
    const { steps, analysis } = fixture(transcripts[0])
    analysis.steps[0].reviewed = false
    const draft = proposeWorkshopDecision(analysis, steps.slice(0, 3), transcripts[0])
    expect([draft.sourceId, draft.mainId, draft.returnTo]).toEqual(['', '', ''])
  })
})

