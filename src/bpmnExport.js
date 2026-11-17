// This deliberately supports only a linear, non-executable model. Never infer
// gateways or drop alternative paths, roles, systems or other workshop data.
export function getLinearBpmnError(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return 'Dodaj i zapisz co najmniej jeden krok.'
  const ids = new Set()
  for (const step of steps) {
    if (!step || typeof step.id !== 'string' || !step.id || ids.has(step.id) || typeof step.name !== 'string' || !step.name.trim()) return 'Lista kroków jest nieprawidłowa. Sprawdź nazwy i identyfikatory kroków.'
    ids.add(step.id)
    if (step.extraConnections !== undefined && (!Array.isArray(step.extraConnections) || step.extraConnections.length)) {
      return 'Eksport BPMN nie obsługuje jeszcze dodatkowych połączeń. Nie można ich pominąć bez zmiany znaczenia procesu.'
    }
  }
  return ''
}

export async function createLinearBpmn({ steps, processName, startName, endName }) {
  const error = getLinearBpmnError(steps)
  if (error) throw new Error(error)
  const { BpmnModdle } = await import('bpmn-moddle')
  const moddle = new BpmnModdle()
  const process = moddle.create('bpmn:Process', { id: 'Process_1', name: processName?.trim() || 'Proces', isExecutable: false, flowElements: [] })
  const start = moddle.create('bpmn:StartEvent', { id: 'StartEvent_1', name: startName?.trim() || 'Początek' })
  const tasks = steps.map((step, index) => moddle.create('bpmn:Task', { id: `Task_${index + 1}`, name: step.name.trim() }))
  const end = moddle.create('bpmn:EndEvent', { id: 'EndEvent_1', name: endName?.trim() || 'Koniec' })
  const nodes = [start, ...tasks, end]
  const flows = nodes.slice(0, -1).map((node, index) => {
    const flow = moddle.create('bpmn:SequenceFlow', { id: `Flow_${index + 1}`, sourceRef: node, targetRef: nodes[index + 1] })
    node.outgoing = [...(node.outgoing || []), flow]
    nodes[index + 1].incoming = [...(nodes[index + 1].incoming || []), flow]
    return flow
  })
  process.flowElements = [...nodes, ...flows]
  const sizes = nodes.map((node, index) => ({ x: 60 + index * 180, y: node === start || node === end ? 112 : 90, width: node === start || node === end ? 36 : 100, height: node === start || node === end ? 36 : 80 }))
  const shapes = nodes.map((node, index) => moddle.create('bpmndi:BPMNShape', { id: `Shape_${index + 1}`, bpmnElement: node, bounds: moddle.create('dc:Bounds', sizes[index]) }))
  const edges = flows.map((flow, index) => moddle.create('bpmndi:BPMNEdge', {
    id: `Edge_${index + 1}`, bpmnElement: flow,
    waypoint: [moddle.create('dc:Point', { x: sizes[index].x + sizes[index].width, y: 130 }), moddle.create('dc:Point', { x: sizes[index + 1].x, y: 130 })],
  }))
  const plane = moddle.create('bpmndi:BPMNPlane', { id: 'Plane_1', bpmnElement: process, planeElement: [...shapes, ...edges] })
  const diagram = moddle.create('bpmndi:BPMNDiagram', { id: 'Diagram_1', plane })
  const definitions = moddle.create('bpmn:Definitions', { id: 'Definitions_1', targetNamespace: 'https://proceshunter.pl/bpmn', rootElements: [process], diagrams: [diagram] })
  const { xml } = await moddle.toXML(definitions, { format: true })
  return xml
}
