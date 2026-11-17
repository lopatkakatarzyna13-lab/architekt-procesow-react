import { useEffect, useRef, useState } from 'react'

export default function BpmnPreview({ steps, scope }) {
  const canvasRef = useRef(null)
  const viewerRef = useRef(null)
  const [status, setStatus] = useState('loading')
  useEffect(() => {
    let cancelled = false
    let viewer
    const load = async () => {
      try {
        const [{ default: NavigatedViewer }, { createDecisionBpmn }] = await Promise.all([
          import('bpmn-js/lib/NavigatedViewer'), import('./bpmnDecisionExport'),
          import('bpmn-js/dist/assets/diagram-js.css'), import('bpmn-js/dist/assets/bpmn-js.css'), import('bpmn-js/dist/assets/bpmn-font/css/bpmn.css'),
        ])
        const xml = await createDecisionBpmn({ steps, processName: scope.processName, startName: scope.processStart, endName: scope.processEnd })
        if (cancelled) return
        viewer = new NavigatedViewer({ container: canvasRef.current })
        const { warnings } = await viewer.importXML(xml)
        if (cancelled) return
        if (warnings.length) { viewer.destroy(); viewer = null; setStatus('warning'); return }
        viewerRef.current = viewer
        viewer.get('canvas').zoom('fit-viewport')
        setStatus('ready')
      } catch { if (!cancelled) { viewer?.destroy(); viewer = null; setStatus('error') } }
    }
    load()
    return () => { cancelled = true; viewerRef.current = null; viewer?.destroy(); viewer = null }
  }, [steps, scope])

  const zoom = (factor) => {
    const canvas = viewerRef.current?.get('canvas')
    if (canvas) canvas.zoom(Math.min(2, Math.max(0.2, canvas.zoom() * factor)), 'auto')
  }
  return <div className="bpmn-preview">
    <div className="bpmn-preview-controls" aria-label="Kontrolki podglądu BPMN">
      <button type="button" className="back-button" disabled={status !== 'ready'} onClick={() => zoom(1.2)}>Powiększ BPMN</button>
      <button type="button" className="back-button" disabled={status !== 'ready'} onClick={() => zoom(1 / 1.2)}>Pomniejsz BPMN</button>
      <button type="button" className="back-button" disabled={status !== 'ready'} onClick={() => viewerRef.current?.get('canvas').zoom('fit-viewport')}>Dopasuj BPMN</button>
    </div>
    {status === 'loading' && <p role="status">Przygotowuję podgląd BPMN…</p>}
    {status === 'warning' && <p role="alert">Nie można potwierdzić poprawnego wyświetlenia wszystkich elementów BPMN. Sprawdź dane procesu.</p>}
    {status === 'error' && <p role="alert">Nie udało się wyświetlić diagramu BPMN. Spróbuj ponownie.</p>}
    <div ref={canvasRef} className="bpmn-preview-canvas" role="img" aria-label="Podgląd zapisanego diagramu BPMN AS-IS" />
  </div>
}
