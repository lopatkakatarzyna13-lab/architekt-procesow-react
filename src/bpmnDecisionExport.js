import { createLinearBpmn, getLinearBpmnError } from './bpmnExport.js'

import { getDecisionBpmnError } from './bpmnDecisionValidation.js'
export { getDecisionBpmnError } from './bpmnDecisionValidation.js'

export async function createDecisionBpmn({ steps, processName, startName, endName }) {
  const error = getDecisionBpmnError(steps)
  if (error) throw new Error(error)
  const hasLanes = steps.some((step) => step.bpmnLane?.trim())
  if (!hasLanes && !steps.some((step) => step.extraConnections?.length)) {
    const linearError = getLinearBpmnError(steps)
    if (linearError) throw new Error(linearError)
    return createLinearBpmn({ steps, processName, startName, endName })
  }
  const { BpmnModdle } = await import('bpmn-moddle')
  const moddle = new BpmnModdle()
  const process = moddle.create('bpmn:Process', { id: 'Process_1', name: processName?.trim() || 'Proces', isExecutable: false, flowElements: [] })
  const start = moddle.create('bpmn:StartEvent', { id: 'StartEvent_1', name: startName?.trim() || 'Początek' })
  const end = moddle.create('bpmn:EndEvent', { id: 'EndEvent_1', name: endName?.trim() || 'Koniec' })
  const tasks = steps.map((step, index) => moddle.create('bpmn:Task', { id: `Task_${index + 1}`, name: step.name.trim() }))
  const indexes = new Map(steps.map((step, index) => [step.id, index]))
  const inbound = steps.map(() => 1)
  for (const step of steps) for (const link of step.extraConnections || []) inbound[indexes.get(link.targetId)] += 1
  const merges = steps.map((_, index) => inbound[index] > 1 ? moddle.create('bpmn:ExclusiveGateway', { id: `Merge_${index + 1}`, gatewayDirection: 'Converging' }) : null)
  const splits = steps.map((step, index) => step.extraConnections?.length ? moddle.create('bpmn:ExclusiveGateway', { id: `Decision_${index + 1}`, name: step.bpmnDecision.question.trim(), gatewayDirection: 'Diverging' }) : null)
  const entry = (index) => merges[index] || tasks[index]
  const laneNames = hasLanes ? [...new Set(steps.map((step) => step.bpmnLane.trim()))] : []
  const laneHeight = 180
  const centerY = (index) => hasLanes ? 190 + laneNames.indexOf(steps[index].bpmnLane.trim()) * laneHeight : 240
  const boxes = new Map()
  boxes.set(start, { x: 70, y: centerY(0) - 18, width: 36, height: 36 })
  boxes.set(end, { x: 250 + steps.length * 360, y: centerY(steps.length - 1) - 18, width: 36, height: 36 })
  steps.forEach((_, index) => {
    const x = 250 + index * 360; const center = centerY(index)
    boxes.set(tasks[index], { x, y: center - 40, width: 100, height: 80 })
    if (merges[index]) boxes.set(merges[index], { x: x - 100, y: center - 25, width: 50, height: 50 })
    if (splits[index]) boxes.set(splits[index], { x: x + 145, y: center - 25, width: 50, height: 50 })
  })
  const lanes = laneNames.map((name, index) => moddle.create('bpmn:Lane', { id: `Lane_${index + 1}`, name, flowNodeRef: [] }))
  if (hasLanes) {
    const laneFor = (index) => lanes[laneNames.indexOf(steps[index].bpmnLane.trim())]
    laneFor(0).flowNodeRef.push(start)
    steps.forEach((_, index) => laneFor(index).flowNodeRef.push(...[merges[index], tasks[index], splits[index]].filter(Boolean)))
    laneFor(steps.length - 1).flowNodeRef.push(end)
    process.laneSets = [moddle.create('bpmn:LaneSet', { id: 'LaneSet_1', lanes })]
  }
  const links = []
  const add = (source, target, label = '', alternate = false) => links.push({ source, target, label, alternate })
  add(start, entry(0))
  steps.forEach((step, index) => {
    if (merges[index]) add(merges[index], tasks[index])
    const next = index + 1 < steps.length ? entry(index + 1) : end
    if (!splits[index]) add(tasks[index], next)
    else {
      add(tasks[index], splits[index])
      add(splits[index], next, step.bpmnDecision.mainLabel.trim())
      for (const link of step.extraConnections) add(splits[index], entry(indexes.get(link.targetId)), link.label.trim(), true)
    }
  })
  const flows = links.map(({ source, target, label }, index) => {
    const flow = moddle.create('bpmn:SequenceFlow', { id: `Flow_${index + 1}`, sourceRef: source, targetRef: target, ...(label ? { name: label } : {}) })
    source.outgoing = [...(source.outgoing || []), flow]
    target.incoming = [...(target.incoming || []), flow]
    return flow
  })
  const nodes = [start, ...steps.flatMap((_, index) => [merges[index], tasks[index], splits[index]].filter(Boolean)), end]
  process.flowElements = [...nodes, ...flows]
  const laneShapes = lanes.map((lane, index) => moddle.create('bpmndi:BPMNShape', { id: `LaneShape_${index + 1}`, bpmnElement: lane, isHorizontal: true, bounds: moddle.create('dc:Bounds', { x: 10, y: 100 + index * laneHeight, width: 250 + steps.length * 360 + 80, height: laneHeight }) }))
  const shapes = nodes.map((node, index) => moddle.create('bpmndi:BPMNShape', { id: `Shape_${index + 1}`, bpmnElement: node, ...(node.$type === 'bpmn:ExclusiveGateway' ? { isMarkerVisible: true } : {}), bounds: moddle.create('dc:Bounds', boxes.get(node)) }))
  const edges = flows.map((flow, index) => {
    const { source, target, alternate } = links[index]
    const a = boxes.get(source); const b = boxes.get(target)
    const startX = a.x + a.width; const endX = b.x; const y1 = a.y + a.height / 2; const y2 = b.y + b.height / 2
    const positions = alternate || endX < startX
      ? [{ x: startX, y: y1 }, { x: startX + 25, y: y1 }, { x: startX + 25, y: 35 + (index % 5) * 25 }, { x: endX - 25, y: 35 + (index % 5) * 25 }, { x: endX - 25, y: y2 }, { x: endX, y: y2 }]
      : y1 === y2 ? [{ x: startX, y: y1 }, { x: endX, y: y2 }]
        : [{ x: startX, y: y1 }, { x: (startX + endX) / 2, y: y1 }, { x: (startX + endX) / 2, y: y2 }, { x: endX, y: y2 }]
    return moddle.create('bpmndi:BPMNEdge', { id: `Edge_${index + 1}`, bpmnElement: flow, waypoint: positions.map((point) => moddle.create('dc:Point', point)) })
  })
  const plane = moddle.create('bpmndi:BPMNPlane', { id: 'Plane_1', bpmnElement: process, planeElement: [...laneShapes, ...shapes, ...edges] })
  const diagram = moddle.create('bpmndi:BPMNDiagram', { id: 'Diagram_1', plane })
  const definitions = moddle.create('bpmn:Definitions', { id: 'Definitions_1', targetNamespace: 'https://proceshunter.pl/bpmn', rootElements: [process], diagrams: [diagram] })
  return (await moddle.toXML(definitions, { format: true })).xml
}
