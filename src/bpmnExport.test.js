import { describe, expect, it } from 'vitest'
import { BpmnModdle } from 'bpmn-moddle'
import { createLinearBpmn, getLinearBpmnError } from './bpmnExport'

const steps = [{ id: 'a', name: 'Sprawdź dane <HR>' }, { id: 'b', name: 'Wyślij & potwierdź' }]

describe('linear BPMN export', () => {
  it('round-trips BPMN nodes, sequence flows and diagram references', async () => {
    const xml = await createLinearBpmn({ steps, processName: 'Fikcyjny proces', startName: 'Zgłoszenie', endName: 'Gotowe' })
    const result = await new BpmnModdle().fromXML(xml)
    expect(result.warnings).toEqual([])
    const process = result.rootElement.rootElements[0]
    expect(process.$type).toBe('bpmn:Process')
    expect(process.isExecutable).toBe(false)
    const nodes = process.flowElements.filter((e) => e.$type !== 'bpmn:SequenceFlow')
    const flows = process.flowElements.filter((e) => e.$type === 'bpmn:SequenceFlow')
    expect(nodes.map((e) => e.$type)).toEqual(['bpmn:StartEvent', 'bpmn:Task', 'bpmn:Task', 'bpmn:EndEvent'])
    expect(nodes.map((e) => e.name)).toEqual(['Zgłoszenie', ...steps.map((s) => s.name), 'Gotowe'])
    expect(flows.map((e) => [e.sourceRef.id, e.targetRef.id])).toEqual(nodes.slice(0, -1).map((e, i) => [e.id, nodes[i + 1].id]))
    const plane = result.rootElement.diagrams[0].plane
    expect(plane.bpmnElement.id).toBe(process.id)
    expect(plane.planeElement.filter((e) => e.$type === 'bpmndi:BPMNShape')).toHaveLength(4)
    expect(plane.planeElement.filter((e) => e.$type === 'bpmndi:BPMNEdge')).toHaveLength(3)
  })
  it('refuses paths and invalid steps rather than silently losing information', async () => {
    for (const input of [[], [{ id: 'a', name: ' ' }], [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }], [{ id: 'a', name: 'A', extraConnections: [{ targetId: 'b', label: 'Nie' }] }], [{ id: 'a', name: 'A', extraConnections: null }]]) {
      expect(getLinearBpmnError(input)).toBeTruthy()
      await expect(createLinearBpmn({ steps: input })).rejects.toThrow()
    }
    expect(getLinearBpmnError(steps)).toBe('')
  })
})
