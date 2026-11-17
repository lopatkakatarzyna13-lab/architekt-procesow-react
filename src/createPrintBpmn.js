import { createDecisionBpmn } from './bpmnDecisionExport'

// Build exactly the same BPMN model as the interactive preview. The temporary
// container stays off-screen but measurable until SVG serialization completes.
export async function createPrintBpmn({ steps, externalSteps, scope }) {
  const xml = await createDecisionBpmn({ steps, externalSteps, processName: scope.processName, startName: scope.processStart, endName: scope.processEnd })
  const { default: Viewer } = await import('bpmn-js/lib/Viewer')
  const container = document.createElement('div')
  Object.assign(container.style, { position: 'fixed', left: '-10000px', top: '0', width: '1200px', height: '800px' })
  document.body.appendChild(container)
  let viewer
  try {
    viewer = new Viewer({ container })
    const { warnings } = await viewer.importXML(xml)
    if (warnings.length) throw new Error('Nie udało się poprawnie odczytać wszystkich elementów BPMN.')
    const { svg } = await viewer.saveSVG()
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  } finally {
    viewer?.destroy()
    container.remove()
  }
}
