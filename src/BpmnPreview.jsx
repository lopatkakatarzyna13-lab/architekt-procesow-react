import BpmnStepSummary from './BpmnStepSummary'
import { useEffect, useRef, useState } from 'react'
import { getBpmnMessages, getExternalPools } from './bpmnMessages.js'

export default function BpmnPreview({ steps, externalSteps = [], externalLinks = [], scope, variant = 'as-is' }) {
  const canvasRef = useRef(null)
  const viewerRef = useRef(null)
  const [status, setStatus] = useState('loading')
  const [selectedId, setSelectedId] = useState('')
  const [navigationError, setNavigationError] = useState('')
  const selectedTask = steps.find((_, index) => selectedId === `Task_${index + 1}`)
  const messages = getBpmnMessages(steps)
  const targets = [
    ...(messages.length ? [
      { id: 'Participant_Main', name: `Basen: ${messages[0].primary}` },
      ...getExternalPools(messages).map(([, name], index) => ({ id: `Participant_External_${index + 1}`, name: `Basen: ${name}` })),
    ] : []),
    ...steps.map((step, index) => ({ id: `Task_${index + 1}`, name: `Krok procesu ${index + 1}: ${step.name}` })),
    ...externalSteps.map((step, index) => ({ id: `ExternalTask_${index + 1}`, name: `Działanie zewnętrzne ${index + 1}: ${step.name}` })),
  ]
  useEffect(() => {
    let cancelled = false
    let viewer
    const load = async () => {
      try {
        const [{ default: NavigatedViewer }, { createBrowserBpmn }] = await Promise.all([
          import('bpmn-js/lib/NavigatedViewer'), import('./createBrowserBpmn'),
          import('bpmn-js/dist/assets/diagram-js.css'), import('bpmn-js/dist/assets/bpmn-js.css'), import('bpmn-js/dist/assets/bpmn-font/css/bpmn.css'),
        ])
        const xml = await createBrowserBpmn({ steps, externalSteps, externalLinks, scope })
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
  }, [steps, externalSteps, externalLinks, scope])

  const zoom = (factor) => {
    const canvas = viewerRef.current?.get('canvas')
    if (canvas) canvas.zoom(Math.min(2, Math.max(0.2, canvas.zoom() * factor)), 'auto')
  }
  const goToElement = () => {
    const viewer = viewerRef.current
    const element = viewer?.get('elementRegistry').get(selectedId)
    if (!element || !Number.isFinite(element.x) || !Number.isFinite(element.y)) {
      setNavigationError('Nie udało się znaleźć tego elementu na mapie.')
      return
    }
    const canvas = viewer.get('canvas')
    canvas.zoom(1, 'auto')
    const view = canvas.viewbox()
    // Participant pools can be very wide: show their name and first part.
    const x = element.x + (element.type === 'bpmn:Participant' ? Math.min(200, element.width / 2) : element.width / 2)
    const y = element.y + (element.type === 'bpmn:Participant' ? Math.min(100, element.height / 2) : element.height / 2)
    canvas.viewbox({ x: x - view.width / 2, y: y - view.height / 2, width: view.width, height: view.height })
    setNavigationError('')
  }
  return <div className="bpmn-preview">
    <div className="bpmn-preview-controls" aria-label="Kontrolki podglądu BPMN">
      <button type="button" className="back-button" disabled={status !== 'ready'} onClick={() => zoom(1.2)}>Powiększ BPMN</button>
      <button type="button" className="back-button" disabled={status !== 'ready'} onClick={() => zoom(1 / 1.2)}>Pomniejsz BPMN</button>
      <button type="button" className="back-button" disabled={status !== 'ready'} onClick={() => viewerRef.current?.get('canvas').zoom('fit-viewport')}>Dopasuj BPMN</button>
    </div>
    <div className="bpmn-preview-controls">
      <label htmlFor="bpmn-target">Przejdź do elementu mapy</label>
      <select id="bpmn-target" value={selectedId} disabled={status !== 'ready'} onChange={(event) => { setSelectedId(event.target.value); setNavigationError('') }}>
        <option value="">Wybierz basen lub działanie</option>
        {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select>
      <button type="button" className="back-button" disabled={status !== 'ready' || !selectedId} onClick={goToElement}>Pokaż na mapie</button>
    </div>
    <p>Wybierz element, aby go przybliżyć. Mapę możesz przesuwać myszą lub dotykiem; użyj przycisku „Dopasuj BPMN”, aby ponownie zobaczyć całość.</p>
    {navigationError && <p role="alert">{navigationError}</p>}
    {status === 'loading' && <p role="status">Przygotowuję podgląd BPMN…</p>}
    {status === 'warning' && <p role="alert">Nie można potwierdzić poprawnego wyświetlenia wszystkich elementów BPMN. Sprawdź dane procesu.</p>}
    {status === 'error' && <p role="alert">Nie udało się wyświetlić diagramu BPMN. Spróbuj ponownie.</p>}
    {selectedTask && <div>
      <h3>{selectedTask.name}</h3>
      <BpmnStepSummary step={selectedTask} />
    </div>}
    <div ref={canvasRef} className="bpmn-preview-canvas" role="img" aria-label={`Podgląd zapisanego diagramu BPMN ${variant === 'to-be' ? 'TO-BE' : 'AS-IS'}`} />
  </div>
}
