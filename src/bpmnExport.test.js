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

  it('keeps the flow attached when a report label requires a larger task', async () => {
    const xml = await createLinearBpmn({
      steps,
      getTaskSize: () => ({ width: 152, height: 240 }),
    })
    const { rootElement, warnings } = await new BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const elements = rootElement.diagrams[0].plane.planeElement
    const bounds = elements.find(({ bpmnElement }) => bpmnElement.id === 'Task_1').bounds
    const flow = elements.find(({ bpmnElement }) => bpmnElement.id === 'Flow_2')
    expect(bounds).toMatchObject({ width: 152, height: 240 })
    expect(flow.waypoint[0]).toMatchObject({ x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 })
  })
})

it('round-trips typed tasks and multiple document associations in a linear diagram', async () => {
  const enriched = [
    { ...steps[0], bpmnTaskType: 'manual', bpmnDocuments: [
      { direction: 'input', name: 'Opis A', format: 'Papier', channel: 'Osobiście' },
      { direction: 'input', name: 'Opis B', format: 'Skan', channel: 'E-mail' },
      { direction: 'output', name: 'Zgłoszenie & dane', format: 'PDF' },
    ] },
    { ...steps[1], bpmnTaskType: 'user', bpmnRule: 'Zweryfikuj dane przed wysyłką.' },
    { id: 'c', name: 'Zapisz', bpmnTaskType: 'service' },
    { id: 'd', name: 'Starszy krok' },
  ]
  const xml = await createLinearBpmn({ steps: enriched })
  const { rootElement, warnings } = await new BpmnModdle().fromXML(xml)
  expect(warnings).toEqual([])
  const { flowElements } = rootElement.rootElements[0]
  const tasks = flowElements.filter((item) => item.$instanceOf('bpmn:Task'))
  expect(tasks.map((task) => task.$type)).toEqual(['bpmn:ManualTask', 'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:Task'])
  expect(tasks[1].documentation[0].text).toContain('Zweryfikuj dane przed wysyłką.')
  const [first] = tasks
  expect(first.dataInputAssociations.map(({ sourceRef }) => sourceRef[0].name)).toEqual(['Opis A', 'Opis B'])
  expect(first.dataInputAssociations[0].sourceRef[0].documentation[0].text).toBe('Format: Papier\nKanał przekazania: Osobiście')
  expect(first.dataOutputAssociations[0].targetRef.name).toBe('Zgłoszenie & dane')
  const diagram = rootElement.diagrams[0].plane.planeElement
  const firstInput = diagram.find(({ bpmnElement }) => bpmnElement.id === 'Document_Task_1_input_1')
  const secondInput = diagram.find(({ bpmnElement }) => bpmnElement.id === 'Document_Task_1_input_2')
  expect(secondInput.label.bounds.x + secondInput.label.bounds.width).toBeLessThan(firstInput.label.bounds.x)
})

it('rejects documents with a missing name or unsupported direction', async () => {
  for (const document of [{ name: ' ', direction: 'input' }, { name: 'Dokument', direction: 'unknown' }]) {
    const input = [{ ...steps[0], bpmnDocuments: [document] }]
    await expect(createLinearBpmn({ steps: input })).rejects.toThrow('Sprawdź nazwy oraz kierunek')
  }
})
