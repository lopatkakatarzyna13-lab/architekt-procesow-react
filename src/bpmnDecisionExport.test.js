import { describe, expect, it } from 'vitest'
import { BpmnModdle } from 'bpmn-moddle'
import { createDecisionBpmn, getDecisionBpmnError } from './bpmnDecisionExport'

const steps = () => [
  { id: 'a', name: 'Uzupełnienie' },
  { id: 'b', name: 'Kontrola', extraConnections: [{ targetId: 'a', label: 'Brak danych' }], bpmnDecision: { question: 'Kompletne?', mainLabel: 'Tak' } },
  { id: 'c', name: 'Zatwierdzenie' },
]

describe('explicit BPMN decisions', () => {
  it('creates named exclusive split, merge and the requested return with diagram coordinates', async () => {
    const { rootElement, warnings } = await new BpmnModdle().fromXML(await createDecisionBpmn({ steps: steps(), processName: 'Fikcyjny proces' }))
    expect(warnings).toEqual([])
    const process = rootElement.rootElements[0]
    expect(process.isExecutable).toBe(false)
    const decision = process.flowElements.find((item) => item.id === 'Decision_2')
    const merge = process.flowElements.find((item) => item.id === 'Merge_1')
    expect(decision.$type).toBe('bpmn:ExclusiveGateway')
    expect(decision.name).toBe('Kompletne?')
    expect(decision.outgoing.map((flow) => [flow.name, flow.targetRef.id])).toEqual([['Tak', 'Task_3'], ['Brak danych', 'Merge_1']])
    expect(merge.incoming).toHaveLength(2)
    expect(merge.outgoing[0].targetRef.id).toBe('Task_1')
    const plane = rootElement.diagrams[0].plane
    expect(plane.planeElement.some((item) => item.bpmnElement.id === decision.id)).toBe(true)
    const returnEdge = plane.planeElement.find((item) => item.bpmnElement?.name === 'Brak danych')
    expect(returnEdge.waypoint.length).toBeGreaterThan(2)
  })
  it('blocks export when user has not identified paths or when links are corrupt or ambiguous', () => {
    const missing = steps(); delete missing[1].bpmnDecision
    expect(getDecisionBpmnError(missing)).toMatch(/Uzupełnij decyzję/)
    const broken = steps(); broken[1].extraConnections[0].targetId = 'missing'
    expect(getDecisionBpmnError(broken)).toMatch(/Sprawdź dodatkowe/)
    const duplicate = steps(); duplicate[1].bpmnDecision.mainLabel = 'brak danych'
    expect(getDecisionBpmnError(duplicate)).toMatch(/muszą się różnić/)
    const malformed = steps(); malformed[1].extraConnections = null
    expect(getDecisionBpmnError(malformed)).toMatch(/Nieprawidłowe połączenia/)
  })
})
