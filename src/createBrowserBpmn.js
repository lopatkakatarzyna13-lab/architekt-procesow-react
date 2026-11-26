import TextRenderer from 'bpmn-js/lib/draw/TextRenderer'
import { defaultBpmnTaskSize } from './bpmnExport.js'
import { createDecisionBpmn } from './bpmnDecisionExport'

const textRenderer = new TextRenderer()

export function createBrowserBpmn({ steps, externalSteps, externalLinks, scope }) {
  const getTaskSize = (name, step) => {
    const size = defaultBpmnTaskSize()
    // The embedded task label is centered. Reserve the same margin above
    // and below it so the task marker in the upper-left corner stays clear.
    const markerSpace = step?.bpmnTaskType ? 42 : 0
    const measure = (width) => textRenderer.getDimensions(name, { box: { width }, padding: 7 }).height + markerSpace
    if (measure(size.width) <= size.height) return size
    const width = 152
    return { width, height: Math.max(size.height, Math.ceil(measure(width))) }
  }
  return createDecisionBpmn({
    steps, externalSteps, externalLinks,
    processName: scope.processName, startName: scope.processStart, endName: scope.processEnd,
    organizationName: scope.organizationName?.trim() || 'Organizacja',
    getTaskSize,
    getLabelHeight: (label, width) => Math.ceil(textRenderer.getDimensions(label, {
      box: { width }, style: textRenderer.getExternalStyle(),
    }).height),
  })
}
