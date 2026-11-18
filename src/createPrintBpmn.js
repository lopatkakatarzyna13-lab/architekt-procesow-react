import { createDecisionBpmn } from './bpmnDecisionExport'
import { defaultBpmnTaskSize } from './bpmnExport'

// Build exactly the same BPMN model as the interactive preview. The temporary
// container stays off-screen but measurable until SVG serialization completes.
export async function createPrintBpmn({ steps, externalSteps, externalLinks, scope }) {
  const { default: Viewer } = await import('bpmn-js/lib/Viewer')
  const container = document.createElement('div')
  Object.assign(container.style, { position: 'fixed', left: '-10000px', top: '0', width: '1200px', height: '800px' })
  document.body.appendChild(container)
  let viewer
  try {
    viewer = new Viewer({ container })
    const textRenderer = viewer.get('textRenderer')
    const getTaskSize = (name) => {
      const size = defaultBpmnTaskSize()
      const padding = 7 // Match the embedded label in bpmn-js.
      const measure = (width) => textRenderer.getDimensions(name, { box: { width }, padding }).height
      if (measure(size.width) <= size.height) return size
      const width = 152
      return { width, height: Math.max(size.height, Math.ceil(measure(width))) }
    }
    const xml = await createDecisionBpmn({
      steps, externalSteps, externalLinks,
      processName: scope.processName, startName: scope.processStart, endName: scope.processEnd,
      getTaskSize,
    })
    const { warnings } = await viewer.importXML(xml)
    if (warnings.length) throw new Error('Nie udało się poprawnie odczytać wszystkich elementów BPMN.')
    const { svg } = await viewer.saveSVG()
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  } finally {
    viewer?.destroy()
    container.remove()
  }
}
