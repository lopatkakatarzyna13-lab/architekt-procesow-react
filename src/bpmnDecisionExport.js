import { createLinearBpmn, getLinearBpmnError } from './bpmnExport.js'
import { getBpmnMessages } from './bpmnMessages.js'

import { getDecisionBpmnError } from './bpmnDecisionValidation.js'
export { getDecisionBpmnError } from './bpmnDecisionValidation.js'

export async function createDecisionBpmn({ steps, externalSteps = [], processName, startName, endName }) {
  const error = getDecisionBpmnError(steps, externalSteps)
  if (error) throw new Error(error)
  const hasLanes = steps.some((step) => step.bpmnLane?.trim())
  const messages = getBpmnMessages(steps)
  const hasCollaboration = messages.length > 0
  if (!hasCollaboration && !hasLanes && !steps.some((step) => step.extraConnections?.length)) {
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
  const laneTop = hasCollaboration ? 10 : 100
  const shiftX = hasCollaboration ? 40 : 0
  const centerY = (index) => hasLanes ? laneTop + laneHeight / 2 + laneNames.indexOf(steps[index].bpmnLane.trim()) * laneHeight : 240
  const boxes = new Map()
  boxes.set(start, { x: 70 + shiftX, y: centerY(0) - 18, width: 36, height: 36 })
  boxes.set(end, { x: 250 + steps.length * 360 + shiftX, y: centerY(steps.length - 1) - 18, width: 36, height: 36 })
  steps.forEach((_, index) => {
    const x = 250 + index * 360 + shiftX; const center = centerY(index)
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
  const poolWidth = Math.max(250 + steps.length * 360 + 80 + shiftX, 230 + externalSteps.length * 220)
  const laneShapes = lanes.map((lane, index) => moddle.create('bpmndi:BPMNShape', { id: `LaneShape_${index + 1}`, bpmnElement: lane, isHorizontal: true, bounds: moddle.create('dc:Bounds', { x: hasCollaboration ? 40 : 10, y: laneTop + index * laneHeight, width: poolWidth - (hasCollaboration ? 30 : 0), height: laneHeight }) }))
  const shapes = nodes.map((node, index) => moddle.create('bpmndi:BPMNShape', { id: `Shape_${index + 1}`, bpmnElement: node, ...(node.$type === 'bpmn:ExclusiveGateway' ? { isMarkerVisible: true } : {}), bounds: moddle.create('dc:Bounds', boxes.get(node)) }))
  const edges = flows.map((flow, index) => {
    const { source, target, alternate } = links[index]
    const a = boxes.get(source); const b = boxes.get(target)
    const startX = a.x + a.width; const endX = b.x; const y1 = a.y + a.height / 2; const y2 = b.y + b.height / 2
    // Alternate flows leave and enter the top of their gateways so a return
    // does not overlap the primary incoming and outgoing sequence flows.
    const routeY = hasCollaboration && hasLanes ? 42 + (index % 2) * 5 : 35 + (index % 5) * 12
    const positions = alternate
      ? [{ x: a.x + a.width / 2, y: a.y }, { x: a.x + a.width / 2, y: routeY }, { x: b.x + b.width / 2, y: routeY }, { x: b.x + b.width / 2, y: b.y }]
      : y1 === y2 ? [{ x: startX, y: y1 }, { x: endX, y: y2 }]
        : [{ x: startX, y: y1 }, { x: (startX + endX) / 2, y: y1 }, { x: (startX + endX) / 2, y: y2 }, { x: endX, y: y2 }]
    return moddle.create('bpmndi:BPMNEdge', { id: `Edge_${index + 1}`, bpmnElement: flow, waypoint: positions.map((point) => moddle.create('dc:Point', point)) })
  })
  let planeElement = [...laneShapes, ...shapes, ...edges]
  let rootElements = [process]
  let planeRoot = process
  if (hasCollaboration) {
    const primary = moddle.create('bpmn:Participant', { id: 'Participant_Main', name: messages[0].primary.trim(), processRef: process })
    const externalNames = [...new Map(messages.map((message) => [message.external.trim().toLocaleLowerCase('pl'), message.external.trim()])).entries()]
    const participants = externalNames.map(([, name], index) => moddle.create('bpmn:Participant', { id: `Participant_External_${index + 1}`, name }))
    const participantByName = new Map(externalNames.map(([key], index) => [key, participants[index]]))
    const externalProcess = externalSteps.length ? moddle.create('bpmn:Process', { id: 'Process_External', name: externalNames[0][1], isExecutable: false, flowElements: [] }) : null
    const externalTasks = externalSteps.map((step, index) => moddle.create('bpmn:Task', { id: `ExternalTask_${index + 1}`, name: step.name.trim() }))
    if (externalProcess) participants[0].processRef = externalProcess
    const externalFlows = externalTasks.slice(1).map((task, index) => {
      const previous = externalTasks[index]
      const flow = moddle.create('bpmn:SequenceFlow', { id: `ExternalFlow_${index + 1}`, sourceRef: previous, targetRef: task })
      previous.outgoing = [...(previous.outgoing || []), flow]; task.incoming = [...(task.incoming || []), flow]
      return flow
    })
    if (externalProcess) externalProcess.flowElements = [...externalTasks, ...externalFlows]
    const externalTaskById = new Map(externalSteps.map((step, index) => [step.id, externalTasks[index]]))
    const collaboration = moddle.create('bpmn:Collaboration', { id: 'Collaboration_1', participants: [primary, ...participants], messageFlows: [] })
    const mainHeight = hasLanes ? laneNames.length * laneHeight : 320
    const mainShape = moddle.create('bpmndi:BPMNShape', { id: 'ParticipantShape_Main', bpmnElement: primary, isHorizontal: true, bounds: moddle.create('dc:Bounds', { x: 10, y: 10, width: poolWidth, height: mainHeight }) })
    // Separate message labels into rows in the gap between the pools.
    const messageGap = 80 + messages.length * 70
    const externalBoxes = participants.map((participant, index) => ({ x: 10, y: 10 + mainHeight + messageGap + index * 110, width: poolWidth, height: externalProcess ? 180 : 70, participant }))
    const externalShapes = externalBoxes.map((box, index) => moddle.create('bpmndi:BPMNShape', { id: `ParticipantShape_External_${index + 1}`, bpmnElement: box.participant, isHorizontal: true, bounds: moddle.create('dc:Bounds', { x: box.x, y: box.y, width: box.width, height: box.height }) }))
    const externalTaskBoxes = externalTasks.map((task, index) => ({ x: 100 + index * 220, y: externalBoxes[0].y + 50, width: 100, height: 80, task }))
    const externalTaskShapes = externalTaskBoxes.map((box, index) => moddle.create('bpmndi:BPMNShape', { id: `ExternalTaskShape_${index + 1}`, bpmnElement: box.task, bounds: moddle.create('dc:Bounds', { x: box.x, y: box.y, width: box.width, height: box.height }) }))
    const externalFlowEdges = externalFlows.map((flow, index) => {
      const a = externalTaskBoxes[index]; const b = externalTaskBoxes[index + 1]
      return moddle.create('bpmndi:BPMNEdge', { id: `ExternalFlowEdge_${index + 1}`, bpmnElement: flow, waypoint: [{ x: a.x + a.width, y: a.y + a.height / 2 }, { x: b.x, y: b.y + b.height / 2 }].map((point) => moddle.create('dc:Point', point)) })
    })
    const messageEdges = messages.map((message, index) => {
      const task = tasks[indexes.get(message.stepId)]
      const external = participantByName.get(message.external.trim().toLocaleLowerCase('pl'))
      const externalTarget = message.externalStepId ? externalTaskById.get(message.externalStepId) : external
      const messageFlow = moddle.create('bpmn:MessageFlow', { id: `MessageFlow_${index + 1}`, name: message.label.trim(), sourceRef: message.direction === 'outgoing' ? task : externalTarget, targetRef: message.direction === 'outgoing' ? externalTarget : task })
      collaboration.messageFlows.push(messageFlow)
      const taskBox = boxes.get(task); const externalBox = externalBoxes.find((box) => box.participant === external)
      const sameTask = messages.filter((item) => item.stepId === message.stepId)
      const localIndex = sameTask.indexOf(message)
      const offset = sameTask.length > 1 ? (localIndex / (sameTask.length - 1) - 0.5) * 60 : 0
      const x = taskBox.x + taskBox.width / 2 + offset
      const taskPoint = { x, y: taskBox.y + taskBox.height }
      const externalTaskBox = externalTaskBoxes.find((box) => box.task === externalTarget)
      const sameTarget = externalTaskBox ? messages.filter((item) => item.externalStepId === message.externalStepId) : []
      const targetOffset = sameTarget.length > 1 ? (sameTarget.indexOf(message) / (sameTarget.length - 1) - 0.5) * 60 : 0
      const poolPoint = externalTaskBox ? { x: externalTaskBox.x + externalTaskBox.width / 2 + targetOffset, y: externalTaskBox.y } : { x: Math.min(poolWidth - 30, x + 120), y: externalBox.y }
      const middleY = 10 + mainHeight + 65 + index * 70
      const forward = x === poolPoint.x ? [taskPoint, poolPoint] : [taskPoint, { x, y: middleY }, { x: poolPoint.x, y: middleY }, poolPoint]
      const points = message.direction === 'outgoing' ? forward : [...forward].reverse()
      const labelX = x === poolPoint.x ? x + 8 : (x + poolPoint.x) / 2 - 90
      const label = moddle.create('bpmndi:BPMNLabel', { bounds: moddle.create('dc:Bounds', { x: labelX, y: middleY - 48, width: 180, height: 44 }) })
      return moddle.create('bpmndi:BPMNEdge', { id: `MessageEdge_${index + 1}`, bpmnElement: messageFlow, waypoint: points.map((point) => moddle.create('dc:Point', point)), label })
    })
    planeRoot = collaboration
    rootElements = [process, ...(externalProcess ? [externalProcess] : []), collaboration]
    planeElement = [mainShape, ...laneShapes, ...externalShapes, ...shapes, ...externalTaskShapes, ...edges, ...externalFlowEdges, ...messageEdges]
  }
  const plane = moddle.create('bpmndi:BPMNPlane', { id: 'Plane_1', bpmnElement: planeRoot, planeElement })
  const diagram = moddle.create('bpmndi:BPMNDiagram', { id: 'Diagram_1', plane })
  const definitions = moddle.create('bpmn:Definitions', { id: 'Definitions_1', targetNamespace: 'https://proceshunter.pl/bpmn', rootElements, diagrams: [diagram] })
  return (await moddle.toXML(definitions, { format: true })).xml
}
