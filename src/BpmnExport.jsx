import { lazy, Suspense, useState } from 'react'
const BpmnPreview = lazy(() => import('./BpmnPreview'))
import { getDecisionBpmnError } from './bpmnDecisionValidation'
import { toBeBpmnScope } from './toBeBpmn'

export default function BpmnExport({ steps, externalSteps = [], externalLinks = [], scope, saved, variant = 'as-is', readOnly = false }) {
  const [message, setMessage] = useState('')
  const [previewKey, setPreviewKey] = useState(null)
  const toBe = variant === 'to-be'
  const bpmnScope = toBe ? toBeBpmnScope(scope) : scope
  const error = getDecisionBpmnError(steps, externalSteps, externalLinks)
  const snapshot = JSON.stringify([steps, externalSteps, externalLinks, bpmnScope.processName, bpmnScope.processStart, bpmnScope.processEnd])
  const previewVisible = saved && !error && previewKey === snapshot
  const exportFile = async () => {
    if (!saved || error) return
    try {
      const { createBrowserBpmn } = await import('./createBrowserBpmn')
      const xml = await createBrowserBpmn({ steps, externalSteps, externalLinks, scope: bpmnScope })
      const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = toBe ? 'proces-tobe.bpmn' : 'proces-asis.bpmn'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Plik BPMN został przygotowany do pobrania.')
    } catch { setMessage('Nie udało się przygotować pliku BPMN. Spróbuj ponownie.') }
  }
  return <section className="step-connections" aria-labelledby="bpmn-export-title">
    <h2 id="bpmn-export-title">{readOnly ? `BPMN 2.0 — ${toBe ? 'TO-BE' : 'AS-IS'}` : toBe ? 'Mapa BPMN 2.0 procesu TO-BE' : 'Eksport procesu BPMN 2.0'}</h2>
    <p>Mapa pokazuje zapisane zadania, dokumenty, decyzje, tory i przekazania. W podglądzie wybierz krok, aby odczytać szczegóły wykonania. Plik BPMN zawiera te szczegóły w dokumentacji elementów.</p>
    {!readOnly && !toBe && <p>Dla dodatkowych przejść uzupełnij decyzję i warunek podstawowej ścieżki. Jeśli używasz torów, przypisz tor do każdego kroku.</p>}
    {!readOnly && toBe && <p>Początek i koniec mają ogólne nazwy. Mapę możesz skopiować z AS-IS i dostosować w TO-BE.</p>}
    {!saved && <p>Najpierw zapisz proces {toBe ? 'TO-BE' : 'AS-IS'}.</p>}
    {error && <p>{error}</p>}
    <div className="bpmn-actions">
      <button type="button" className="back-button" disabled={!saved || Boolean(error)} onClick={() => setPreviewKey(previewVisible ? null : snapshot)}>{previewVisible ? 'Ukryj podgląd BPMN' : 'Pokaż podgląd BPMN'}</button>
      <button type="button" className="back-button" disabled={!saved || Boolean(error)} onClick={exportFile}>Pobierz BPMN 2.0</button>
    </div>
    {previewVisible && <Suspense fallback={<p role="status">Przygotowuję podgląd BPMN…</p>}><BpmnPreview key={snapshot} steps={steps} externalSteps={externalSteps} externalLinks={externalLinks} scope={bpmnScope} variant={variant} /></Suspense>}
    {message && <p role="status">{message}</p>}
  </section>
}
