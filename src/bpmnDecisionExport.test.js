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
    const decisionBox = plane.planeElement.find((item) => item.bpmnElement?.id === decision.id).bounds
    const mergeBox = plane.planeElement.find((item) => item.bpmnElement?.id === merge.id).bounds
    expect(returnEdge.waypoint[0]).toMatchObject({ x: decisionBox.x + decisionBox.width / 2, y: decisionBox.y })
    expect(returnEdge.waypoint.at(-1)).toMatchObject({ x: mergeBox.x + mergeBox.width / 2, y: mergeBox.y })
  })
  it('exports explicitly assigned lanes and associates all nodes without altering connections', async () => {
    const input = steps().map((step, index) => ({ ...step, bpmnLane: index === 1 ? 'Biuro rachunkowe' : 'HR' }))
    const { rootElement, warnings } = await new BpmnModdle().fromXML(await createDecisionBpmn({ steps: input }))
    expect(warnings).toEqual([])
    const process = rootElement.rootElements[0]
    expect(process.laneSets).toHaveLength(1)
    const lanes = process.laneSets[0].lanes
    expect(lanes.map((lane) => lane.name)).toEqual(['HR', 'Biuro rachunkowe'])
    expect(lanes[0].flowNodeRef.map((node) => node.id)).toEqual(['StartEvent_1', 'Merge_1', 'Task_1', 'Task_3', 'EndEvent_1'])
    expect(lanes[1].flowNodeRef.map((node) => node.id)).toEqual(['Task_2', 'Decision_2'])
    expect(rootElement.diagrams[0].plane.planeElement.filter((shape) => shape.bpmnElement?.$type === 'bpmn:Lane')).toHaveLength(2)
    const decision = process.flowElements.find((element) => element.id === 'Decision_2')
    expect(decision.outgoing.map((flow) => [flow.name, flow.targetRef.id])).toEqual([['Tak', 'Task_3'], ['Brak danych', 'Merge_1']])
  })
  it('requires every step to have a lane when any lane is supplied', () => {
    const input = steps(); input[0].bpmnLane = 'HR'
    expect(getDecisionBpmnError(input)).toMatch(/Uzupełnij tor BPMN dla każdego kroku/)
    input[1].bpmnLane = 'HR'; input[2].bpmnLane = 'Biuro'
    expect(getDecisionBpmnError(input)).toBe('')
    input[1].bpmnLane = null
    expect(getDecisionBpmnError(input)).toMatch(/Nieprawidłowa nazwa toru/)
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
