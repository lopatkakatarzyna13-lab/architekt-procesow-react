import { bpmnTaskTypes, getBpmnDocuments, getBpmnStepDetails } from './bpmnStepDetails.js'

export function createBpmnTask(moddle, step, id) {
  const type = Object.hasOwn(bpmnTaskTypes, step.bpmnTaskType) ? bpmnTaskTypes[step.bpmnTaskType].element : 'bpmn:Task'
  const details = getBpmnStepDetails(step)
  const task = moddle.create(type, { id, name: step.name.trim() })
  if (details.length) {
    task.documentation = [moddle.create('bpmn:Documentation', {
      text: details.map(([label, value]) => `${label}: ${value}`).join('\n'),
    })]
  }
  return task
}

const documentSpacing = 116
const labelHeight = (name) => Math.max(20, Math.ceil(name.trim().length / 10) * 16)

export function getBpmnDataLayout(steps) {
  const groups = steps.map((step) => {
    const documents = getBpmnDocuments(step)
    return {
      input: documents.filter(({ direction }) => direction === 'input'),
      output: documents.filter(({ direction }) => direction === 'output'),
    }
  })
  const extraSpace = (documents) => Math.max(0, documents.length - 1) * documentSpacing
  const height = Math.max(0, ...groups.flatMap(({ input, output }) => [...input, ...output]
    .map(({ name }) => 90 + labelHeight(name))))
  return {
    groups,
    height,
    offsets: groups.reduce((offsets, group, index) => {
      offsets.push(extraSpace(group.input) + (index ? offsets[index - 1] + extraSpace(groups[index - 1].output) : 0))
      return offsets
    }, []),
    lastExtra: extraSpace(groups.at(-1).output),
  }
}

export function addBpmnDataObjects(moddle, groups, tasks, getBounds, maxTaskHeight) {
  const elements = []
  const shapes = []
  const edges = []
  const makeBounds = (attributes) => moddle.create('dc:Bounds', attributes)

  tasks.forEach((task, taskIndex) => {
    const bounds = getBounds(task, taskIndex)
    const middle = bounds.x + bounds.width / 2
    const y = bounds.y + bounds.height / 2 + maxTaskHeight / 2 + 34

    Object.entries(groups[taskIndex]).forEach(([direction, documents]) => {
      const input = direction === 'input'
      const sign = input ? -1 : 1
      documents.forEach(({ name, format, channel }, index) => {
        const id = `${task.id}_${direction}_${index + 1}`
        const object = moddle.create('bpmn:DataObject', { id: `Data_${id}` })
        const reference = moddle.create('bpmn:DataObjectReference', {
          id: `Document_${id}`, name: name.trim(), dataObjectRef: object,
        })
        const details = [['Format', format], ['Kanał przekazania', channel]]
          .filter(([, value]) => value?.trim()).map(([label, value]) => `${label}: ${value.trim()}`)
        if (details.length) reference.documentation = [moddle.create('bpmn:Documentation', { text: details.join('\n') })]

        const property = moddle.create('bpmn:Property', { id: `Property_${id}`, name: reference.name })
        task.get('properties').push(property)
        const association = moddle.create(input ? 'bpmn:DataInputAssociation' : 'bpmn:DataOutputAssociation', {
          id: `Association_${id}`, sourceRef: [input ? reference : property], targetRef: input ? property : reference,
        })
        task.get(input ? 'dataInputAssociations' : 'dataOutputAssociations').push(association)
        elements.push(object, reference)

        const x = middle + sign * (62 + index * documentSpacing)
        const taskX = middle + sign * bounds.width / 2 * (index + 1) / (documents.length + 1)
        const documentPoint = { x, y }
        const taskPoint = { x: taskX, y: bounds.y + bounds.height }
        shapes.push(moddle.create('bpmndi:BPMNShape', {
          id: `Shape_${reference.id}`,
          bpmnElement: reference,
          bounds: makeBounds({ x: x - 18, y, width: 36, height: 50 }),
          label: moddle.create('bpmndi:BPMNLabel', {
            bounds: makeBounds({ x: x - 55, y: y + 50, width: 110, height: labelHeight(name) }),
          }),
        }))
        edges.push(moddle.create('bpmndi:BPMNEdge', {
          id: `Edge_${association.id}`, bpmnElement: association,
          waypoint: (input ? [documentPoint, taskPoint] : [taskPoint, documentPoint]).map((point) => moddle.create('dc:Point', point)),
        }))
      })
    })
  })
  return { elements, shapes, edges }
}
