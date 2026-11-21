import { addBpmnDataObjects, createBpmnTask, getBpmnDataLayout } from './bpmnTaskModel.js'
import { createLinearBpmn, defaultBpmnTaskSize, getLinearBpmnError } from './bpmnExport.js'
import { getBpmnMessages, getExternalActionPool, getExternalPools } from './bpmnMessages.js'
import { getNextProcessStepId } from './processConnections.js'

import { getDecisionBpmnError } from './bpmnDecisionValidation.js'
export { getDecisionBpmnError } from './bpmnDecisionValidation.js'

export async function createDecisionBpmn({ steps, externalSteps = [], externalLinks = [], processName, startName, endName, getTaskSize = defaultBpmnTaskSize }) {
  const error = getDecisionBpmnError(steps, externalSteps, externalLinks)
  if (error) throw new Error(error)
  const hasLanes = steps.some((step) => step.bpmnLane?.trim())
  const messages = getBpmnMessages(steps)
  const hasCollaboration = messages.length > 0
  if (!hasCollaboration && !hasLanes && !steps.some((step) => step.extraConnections?.length || step.nextStepId)) {
    const linearError = getLinearBpmnError(steps)
    if (linearError) throw new Error(linearError)
    return createLinearBpmn({ steps, processName, startName, endName, getTaskSize })
  }
  const { BpmnModdle } = await import('bpmn-moddle')
  const moddle = new BpmnModdle()
  const process = moddle.create('bpmn:Process', { id: 'Process_1', name: processName?.trim() || 'Proces', isExecutable: false, flowElements: [] })
  const start = moddle.create('bpmn:StartEvent', { id: 'StartEvent_1', name: startName?.trim() || 'Początek' })
  const end = moddle.create('bpmn:EndEvent', { id: 'EndEvent_1', name: endName?.trim() || 'Koniec' })
  const tasks = steps.map((step, index) => createBpmnTask(moddle, step, `Task_${index + 1}`))
  const indexes = new Map(steps.map((step, index) => [step.id, index]))
  const nextIndexes = steps.map((_, index) => indexes.get(getNextProcessStepId(steps, index)))
  const inbound = steps.map((_, index) => index === 0 ? 1 : 0)
  steps.forEach((step, index) => {
    const nextIndex = nextIndexes[index]
    if (nextIndex !== undefined) inbound[nextIndex] += 1
    for (const link of step.extraConnections || []) inbound[indexes.get(link.targetId)] += 1
  })
  const merges = steps.map((_, index) => inbound[index] > 1 ? moddle.create('bpmn:ExclusiveGateway', { id: `Merge_${index + 1}`, gatewayDirection: 'Converging' }) : null)
  const splits = steps.map((step, index) => step.extraConnections?.length ? moddle.create('bpmn:ExclusiveGateway', { id: `Decision_${index + 1}`, name: step.bpmnDecision.question.trim(), gatewayDirection: 'Diverging' }) : null)
  const entry = (index) => merges[index] || tasks[index]
  const links = []
  const add = (source, target, label = '', alternate = false) => links.push({ source, target, label, alternate })
  add(start, entry(0))
  steps.forEach((step, index) => {
    if (merges[index]) add(merges[index], tasks[index])
    const nextIndex = nextIndexes[index]
    const next = nextIndex === undefined ? end : entry(nextIndex)
    const routed = nextIndex !== undefined && nextIndex !== index + 1
    if (!splits[index]) add(tasks[index], next, '', routed)
    else {
      add(tasks[index], splits[index])
      add(splits[index], next, step.bpmnDecision.mainLabel.trim(), routed)
      for (const link of step.extraConnections) add(splits[index], entry(indexes.get(link.targetId)), link.label.trim(), true)
    }
  })
  const laneNames = hasLanes ? [...new Set(steps.map((step) => step.bpmnLane.trim()))] : []
  const dataLayout = getBpmnDataLayout(steps)
  const taskSizes = tasks.map((task, index) => getTaskSize(task.name, steps[index]))
  const taskColumns = [250]
  for (let index = 1; index < steps.length; index += 1) {
    const gatewaySpace = (splits[index - 1] ? 115 : 24) + (merges[index] ? 100 : 0)
    const gap = dataLayout.height ? Math.max(280, taskSizes[index - 1].width + gatewaySpace) : 360
    taskColumns.push(taskColumns[index - 1] + gap)
  }
  const maxTaskHeight = Math.max(...taskSizes.map(({ height }) => height))
  const taskBandHeight = Math.max(180, maxTaskHeight + 100)
  const laneHeight = taskBandHeight + dataLayout.height
  const laneTop = hasCollaboration ? 10 : 100
  const routingTop = hasLanes ? laneTop : hasCollaboration ? 10 : 0
  const alternateLayout = new Map()
  const alternateLabelWidth = 180
  let nextLabelY = routingTop + 8
  for (const link of links.filter(({ alternate }) => alternate)) {
    const height = link.label ? Math.ceil(link.label.length / 16) * 16 + 4 : 0
    const routeY = nextLabelY + height + 8
    alternateLayout.set(link, { y: nextLabelY, height, routeY })
    nextLabelY = routeY + 12
  }
  const baseUnlanedCenter = Math.max(240, maxTaskHeight / 2 + 110)
  const firstShapeTop = hasLanes ? laneTop + (taskBandHeight - maxTaskHeight) / 2 : baseUnlanedCenter - maxTaskHeight / 2
  const routingPadding = Math.max(0, nextLabelY - firstShapeTop)
  const unlanedCenter = baseUnlanedCenter + routingPadding
  const shiftX = hasCollaboration ? 40 : 0
  const centerY = (index) => hasLanes ? laneTop + taskBandHeight / 2 + routingPadding + laneNames.indexOf(steps[index].bpmnLane.trim()) * laneHeight : unlanedCenter
  const boxes = new Map()
  boxes.set(start, { x: 70 + shiftX, y: centerY(0) - 18, width: 36, height: 36 })
  const endX = taskColumns.at(-1) + (dataLayout.height ? 280 : 360) + shiftX + dataLayout.offsets.at(-1) + dataLayout.lastExtra
  boxes.set(end, { x: endX, y: centerY(steps.length - 1) - 18, width: 36, height: 36 })
  steps.forEach((_, index) => {
    const x = taskColumns[index] + shiftX + dataLayout.offsets[index]; const center = centerY(index)
    const size = taskSizes[index]
    boxes.set(tasks[index], { x, y: center - size.height / 2, ...size })
    if (merges[index]) boxes.set(merges[index], { x: x - 100, y: center - 25, width: 50, height: 50 })
    if (splits[index]) boxes.set(splits[index], { x: x + size.width + 45, y: center - 25, width: 50, height: 50 })
  })
  const lanes = laneNames.map((name, index) => moddle.create('bpmn:Lane', { id: `Lane_${index + 1}`, name, flowNodeRef: [] }))
  if (hasLanes) {
    const laneFor = (index) => lanes[laneNames.indexOf(steps[index].bpmnLane.trim())]
    laneFor(0).flowNodeRef.push(start)
    steps.forEach((_, index) => laneFor(index).flowNodeRef.push(...[merges[index], tasks[index], splits[index]].filter(Boolean)))
    laneFor(steps.length - 1).flowNodeRef.push(end)
    process.laneSets = [moddle.create('bpmn:LaneSet', { id: 'LaneSet_1', lanes })]
  }
  const flows = links.map(({ source, target, label }, index) => {
    const flow = moddle.create('bpmn:SequenceFlow', { id: `Flow_${index + 1}`, sourceRef: source, targetRef: target, ...(label ? { name: label } : {}) })
    source.outgoing = [...(source.outgoing || []), flow]
    target.incoming = [...(target.incoming || []), flow]
    return flow
  })
  const nodes = [start, ...steps.flatMap((_, index) => [merges[index], tasks[index], splits[index]].filter(Boolean)), end]
  const data = addBpmnDataObjects(moddle, dataLayout.groups, tasks, (task) => boxes.get(task), maxTaskHeight)
  process.flowElements = [...nodes, ...flows, ...data.elements]
  const poolWidth = Math.max(endX + 80, 230 + externalSteps.length * 220)
  const laneShapes = lanes.map((lane, index) => moddle.create('bpmndi:BPMNShape', { id: `LaneShape_${index + 1}`, bpmnElement: lane, isHorizontal: true, bounds: moddle.create('dc:Bounds', { x: hasCollaboration ? 40 : 10, y: laneTop + index * laneHeight + (index ? routingPadding : 0), width: poolWidth - (hasCollaboration ? 30 : 0), height: laneHeight + (index ? 0 : routingPadding) }) }))
  const shapes = nodes.map((node, index) => moddle.create('bpmndi:BPMNShape', { id: `Shape_${index + 1}`, bpmnElement: node, ...(node.$type === 'bpmn:ExclusiveGateway' ? { isMarkerVisible: true } : {}), bounds: moddle.create('dc:Bounds', boxes.get(node)) }))
  // Separate approaches when two alternate flows converge on the same gateway.
  const approachesByTarget = new Map()
  for (const link of alternateLayout.keys()) {
    const approaches = approachesByTarget.get(link.target) ?? []
    approaches.push(link)
    approachesByTarget.set(link.target, approaches)
  }
  const approachOffset = new Map()
  for (const approaches of approachesByTarget.values()) {
    approaches.sort((a, b) => boxes.get(a.source).x - boxes.get(b.source).x)
    approaches.forEach((link, index) => {
      approachOffset.set(link, 20 * ((index + 1) / (approaches.length + 1) - 0.5))
    })
  }
  const edges = flows.map((flow, index) => {
    const { source, target } = links[index]
    const alternate = alternateLayout.get(links[index])
    const a = boxes.get(source); const b = boxes.get(target)
    const startX = a.x + a.width; const endX = b.x; const y1 = a.y + a.height / 2; const y2 = b.y + b.height / 2
    // Alternate flows leave and enter the top of their gateways so a return
    // does not overlap the primary incoming and outgoing sequence flows.
    const offset = approachOffset.get(links[index]) ?? 0
    const targetPortX = b.x + b.width / 2 + offset
    const positions = alternate
      ? [{ x: a.x + a.width / 2, y: a.y }, { x: a.x + a.width / 2, y: alternate.routeY }, { x: targetPortX, y: alternate.routeY }, { x: targetPortX, y: b.y + Math.abs(offset) }]
      : y1 === y2 ? [{ x: startX, y: y1 }, { x: endX, y: y2 }]
        : [{ x: startX, y: y1 }, { x: (startX + endX) / 2, y: y1 }, { x: (startX + endX) / 2, y: y2 }, { x: endX, y: y2 }]
    const edge = moddle.create('bpmndi:BPMNEdge', { id: `Edge_${index + 1}`, bpmnElement: flow, waypoint: positions.map((point) => moddle.create('dc:Point', point)) })
    if (alternate && flow.name) {
      const centerX = (positions[1].x + positions[2].x) / 2
      edge.label = moddle.create('bpmndi:BPMNLabel', {
        bounds: moddle.create('dc:Bounds', { x: centerX - alternateLabelWidth / 2, y: alternate.y, width: alternateLabelWidth, height: alternate.height }),
      })
    }
    return edge
  })
  let planeElement = [...laneShapes, ...shapes, ...data.shapes, ...edges, ...data.edges]
  let rootElements = [process]
  let planeRoot = process
  if (hasCollaboration) {
    const primary = moddle.create('bpmn:Participant', { id: 'Participant_Main', name: messages[0].primary.trim(), processRef: process })
    const externalNames = getExternalPools(messages)
    const activitiesByPool = new Map(externalNames.map(([key]) => [key, []]))
    const externalTaskById = new Map()
    externalSteps.forEach((step, index) => {
      const task = moddle.create('bpmn:Task', { id: `ExternalTask_${index + 1}`, name: step.name.trim() })
      externalTaskById.set(step.id, task)
      activitiesByPool.get(getExternalActionPool(step, messages, externalNames)).push(task)
    })
    let flowIndex = 0
    const pools = externalNames.map(([key, name], index) => {
      const tasks = activitiesByPool.get(key)
      const flows = tasks.slice(1).map((target, i) => {
        const source = tasks[i]
        const flow = moddle.create('bpmn:SequenceFlow', { id: `ExternalFlow_${++flowIndex}`, sourceRef: source, targetRef: target })
        source.outgoing = [flow]
        target.incoming = [flow]
        return flow
      })
      const processRef = tasks.length ? moddle.create('bpmn:Process', {
        id: `Process_External_${index + 1}`, name, isExecutable: false, flowElements: [...tasks, ...flows],
      }) : undefined
      const participant = moddle.create('bpmn:Participant', { id: `Participant_External_${index + 1}`, name, ...(processRef ? { processRef } : {}) })
      return { participant, processRef, tasks, flows }
    })
    const poolByName = new Map(externalNames.map(([key], index) => [key, pools[index]]))
    const participants = pools.map(({ participant }) => participant)
    const collaboration = moddle.create('bpmn:Collaboration', { id: 'Collaboration_1', participants: [primary, ...participants], messageFlows: [] })
    const mainHeight = hasLanes ? laneNames.length * laneHeight + routingPadding : Math.max(320, unlanedCenter + maxTaskHeight / 2 + 30 + dataLayout.height)
    const mainShape = moddle.create('bpmndi:BPMNShape', { id: 'ParticipantShape_Main', bpmnElement: primary, isHorizontal: true, bounds: moddle.create('dc:Bounds', { x: 10, y: 10, width: poolWidth, height: mainHeight }) })
    // Reserve a separate row for each label; longer names need additional lines.
    const labelHeights = messages.map((message) => Math.max(44, Math.ceil(message.label.trim().length / 18) * 16 + 16))
    const rowTops = labelHeights.map((_, index) => labelHeights.slice(0, index).reduce((sum, height) => sum + height + 26, 0))
    const messageGap = 80 + labelHeights.reduce((sum, height) => sum + height + 26, 0)
    let nextPoolY = 10 + mainHeight + messageGap
    const externalTaskBoxes = new Map()
    const externalShapes = pools.map((pool, index) => {
      const sizes = pool.tasks.map((task) => getTaskSize(task.name))
      const bounds = { x: 10, y: nextPoolY, width: poolWidth, height: sizes.length ? 100 + Math.max(...sizes.map(({ height }) => height)) : 70 }
      pool.bounds = bounds
      pool.index = index
      nextPoolY += bounds.height + 60
      pool.tasks.forEach((task, i) => externalTaskBoxes.set(task, { x: 100 + i * 220, y: bounds.y + (bounds.height - sizes[i].height) / 2, ...sizes[i] }))
      return moddle.create('bpmndi:BPMNShape', { id: `ParticipantShape_External_${index + 1}`, bpmnElement: pool.participant, isHorizontal: true, bounds: moddle.create('dc:Bounds', bounds) })
    })
    const externalTaskShapes = [...externalTaskBoxes].map(([task, bounds], index) => moddle.create('bpmndi:BPMNShape', { id: `ExternalTaskShape_${index + 1}`, bpmnElement: task, bounds: moddle.create('dc:Bounds', bounds) }))
    const externalFlowEdges = pools.flatMap(({ flows }) => flows).map((flow, index) => {
      const a = externalTaskBoxes.get(flow.sourceRef)
      const b = externalTaskBoxes.get(flow.targetRef)
      return moddle.create('bpmndi:BPMNEdge', { id: `ExternalFlowEdge_${index + 1}`, bpmnElement: flow, waypoint: [{ x: a.x + a.width, y: a.y + a.height / 2 }, { x: b.x, y: b.y + b.height / 2 }].map((point) => moddle.create('dc:Point', point)) })
    })
    const messageEdges = messages.map((message, index) => {
      const task = tasks[indexes.get(message.stepId)]
      const pool = poolByName.get(message.external.trim().toLocaleLowerCase('pl'))
      const external = pool.participant
      const externalTarget = message.externalStepId ? externalTaskById.get(message.externalStepId) : external
      const messageFlow = moddle.create('bpmn:MessageFlow', { id: `MessageFlow_${index + 1}`, name: message.label.trim(), sourceRef: message.direction === 'outgoing' ? task : externalTarget, targetRef: message.direction === 'outgoing' ? externalTarget : task })
      collaboration.messageFlows.push(messageFlow)
      const taskBox = boxes.get(task); const externalBox = pool.bounds
      const sameTask = messages.filter((item) => item.stepId === message.stepId)
      const localIndex = sameTask.indexOf(message)
      const offset = sameTask.length > 1 ? (localIndex / (sameTask.length - 1) - 0.5) * 60 : 0
      const x = taskBox.x + taskBox.width / 2 + offset
      const taskPoint = { x, y: taskBox.y + taskBox.height }
      const externalTaskBox = externalTaskBoxes.get(externalTarget)
      const sameTarget = externalTaskBox ? messages.filter((item) => item.externalStepId === message.externalStepId) : []
      const targetOffset = sameTarget.length > 1 ? (sameTarget.indexOf(message) / (sameTarget.length - 1) - 0.5) * 60 : 0
      const poolPoint = externalTaskBox ? { x: externalTaskBox.x + externalTaskBox.width / 2 + targetOffset, y: externalTaskBox.y } : { x: Math.min(poolWidth - 30, x + 120), y: externalBox.y }
      const labelY = 10 + mainHeight + 17 + rowTops[index]
      const middleY = labelY + labelHeights[index] + 4
      const bypassX = poolWidth + 36 + index * 14
      const approachY = externalBox.y - 24
      const forward = pool.index > 0
        ? [taskPoint, { x, y: middleY }, { x: bypassX, y: middleY }, { x: bypassX, y: approachY }, { x: poolPoint.x, y: approachY }, poolPoint]
        : x === poolPoint.x ? [taskPoint, poolPoint] : [taskPoint, { x, y: middleY }, { x: poolPoint.x, y: middleY }, poolPoint]
      const points = message.direction === 'outgoing' ? forward : [...forward].reverse()
      // Keep the label to the right of the vertical segment, including
      // other messages from the same task whose ports can be offset by 30.
      const labelX = Math.min(poolWidth - 170, taskBox.x + taskBox.width / 2 + 38)
      const label = moddle.create('bpmndi:BPMNLabel', { bounds: moddle.create('dc:Bounds', { x: labelX, y: labelY, width: 180, height: labelHeights[index] }) })
      return moddle.create('bpmndi:BPMNEdge', { id: `MessageEdge_${index + 1}`, bpmnElement: messageFlow, waypoint: points.map((point) => moddle.create('dc:Point', point)), label })
    })
    const externalMessageEdges = externalLinks.map((link, index) => {
      const source = poolByName.get(link.source)
      const target = poolByName.get(link.target)
      const sourceTask = externalTaskById.get(link.sourceActionId)
      const targetTask = externalTaskById.get(link.targetActionId)
      const messageFlow = moddle.create('bpmn:MessageFlow', {
        id: `ExternalMessageFlow_${index + 1}`,
        name: link.label.trim(),
        sourceRef: sourceTask ?? source.participant,
        targetRef: targetTask ?? target.participant,
      })
      collaboration.messageFlows.push(messageFlow)
      const portY = (pool) => {
        const incident = externalLinks.filter((item) => poolByName.get(item.source) === pool || poolByName.get(item.target) === pool)
        return pool.bounds.y + pool.bounds.height * (incident.indexOf(link) + 1) / (incident.length + 1)
      }
      const poolRight = 10 + poolWidth
      const x = poolRight + 80 + messages.length * 14 + index * 200
      const approach = (pool, otherPool, task, actionId) => {
        if (!task) return [{ x: poolRight, y: portY(pool) }]
        const box = externalTaskBoxes.get(task)
        const facesDown = pool.index < otherPool.index
        const incident = externalLinks.filter((item) => item.sourceActionId === actionId || item.targetActionId === actionId)
        const offset = 60 * ((incident.indexOf(link) + 1) / (incident.length + 1) - 0.5)
        const taskX = box.x + box.width / 2 + offset
        const gapY = facesDown ? pool.bounds.y + pool.bounds.height + 22 : pool.bounds.y - 22
        return [{ x: taskX, y: facesDown ? box.y + box.height : box.y }, { x: taskX, y: gapY }]
      }
      const sourcePoints = approach(source, target, sourceTask, link.sourceActionId)
      const targetPoints = approach(target, source, targetTask, link.targetActionId)
      const sourceY = sourcePoints.at(-1).y
      const targetY = targetPoints.at(-1).y
      const waypoint = [
        ...sourcePoints, { x, y: sourceY }, { x, y: targetY }, ...targetPoints.reverse(),
      ].map((point) => moddle.create('dc:Point', point))
      const label = moddle.create('bpmndi:BPMNLabel', {
        bounds: moddle.create('dc:Bounds', { x: x + 10, y: (sourceY + targetY) / 2 - 22, width: 180, height: 44 }),
      })
      return moddle.create('bpmndi:BPMNEdge', { id: `ExternalMessageEdge_${index + 1}`, bpmnElement: messageFlow, waypoint, label })
    })
    planeRoot = collaboration
    rootElements = [process, ...pools.flatMap(({ processRef }) => processRef ? [processRef] : []), collaboration]
    planeElement = [mainShape, ...laneShapes, ...externalShapes, ...shapes, ...externalTaskShapes, ...data.shapes, ...edges, ...data.edges, ...externalFlowEdges, ...messageEdges, ...externalMessageEdges]
  }
  const plane = moddle.create('bpmndi:BPMNPlane', { id: 'Plane_1', bpmnElement: planeRoot, planeElement })
  const diagram = moddle.create('bpmndi:BPMNDiagram', { id: 'Diagram_1', plane })
  const definitions = moddle.create('bpmn:Definitions', { id: 'Definitions_1', targetNamespace: 'https://proceshunter.pl/bpmn', rootElements, diagrams: [diagram] })
  return (await moddle.toXML(definitions, { format: true })).xml
}
