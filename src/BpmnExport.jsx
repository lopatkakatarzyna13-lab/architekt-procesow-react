import { lazy, Suspense, useState } from 'react'
const BpmnPreview = lazy(() => import('./BpmnPreview'))
import { getDecisionBpmnError } from './bpmnDecisionValidation'
import { getToBeBpmnError, toBeBpmnScope } from './toBeBpmn'

export default function BpmnExport({ steps, externalSteps = [], scope, saved, variant = 'as-is' }) {
  const [message, setMessage] = useState('')
  const [previewKey, setPreviewKey] = useState(null)
  const toBe = variant === 'to-be'
  const bpmnScope = toBe ? toBeBpmnScope(scope) : scope
  const error = toBe ? getToBeBpmnError(steps) : getDecisionBpmnError(steps, externalSteps)
  const snapshot = JSON.stringify([steps, externalSteps, bpmnScope.processName, bpmnScope.processStart, bpmnScope.processEnd])
  const previewVisible = saved && !error && previewKey === snapshot
  const exportFile = async () => {
    if (!saved || error) return
    try {
      const { createDecisionBpmn } = await import('./bpmnDecisionExport')
      const xml = await createDecisionBpmn({ steps, externalSteps, processName: bpmnScope.processName, startName: bpmnScope.processStart, endName: bpmnScope.processEnd })
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
    <h2 id="bpmn-export-title">{toBe ? 'Mapa BPMN 2.0 procesu TO-BE' : 'Eksport procesu BPMN 2.0'}</h2>
    {toBe ? <p>Mapa pokazuje zapisane kroki TO-BE w kolejności listy oraz zapisane decyzje i dodatkowe przejścia. Początek i koniec mają ogólne nazwy. Nie przenosi automatycznie z AS-IS decyzji, dodatkowych przejść, torów, basenów ani wiadomości. Ról, systemów i opisów nie przedstawia jako elementów BPMN. Model nie służy do automatycznego wykonywania procesu.</p> : <p>Eksport obejmuje nazwę procesu, początek, nazwy zadań, koniec, połączenia określone przez Ciebie bramki wyboru jednej ścieżki oraz wskazane wiadomości z zewnętrznymi uczestnikami. Opcjonalne tory są uwzględniane tylko wtedy, gdy przypiszesz je wszystkim krokom. Pola odpowiedzialności, systemy, opisy i ustalenia nie są automatycznie uwzględniane. Plik nie jest przeznaczony do automatycznego wykonywania procesu.</p>}
    {!toBe && <p>Dla dodatkowych przejść uzupełnij decyzję i warunek podstawowej ścieżki. Opisy warunków nie są regułami do automatycznego wykonania. Podgląd i plik powstają z tych samych zapisanych danych. Sprawdź model przed użyciem.</p>}
    {!saved && <p>Najpierw zapisz proces {toBe ? 'TO-BE' : 'AS-IS'}.</p>}
    {error && <p>{error}</p>}
    <div className="bpmn-actions">
      <button type="button" className="back-button" disabled={!saved || Boolean(error)} onClick={() => setPreviewKey(previewVisible ? null : snapshot)}>{previewVisible ? 'Ukryj podgląd BPMN' : 'Pokaż podgląd BPMN'}</button>
      <button type="button" className="back-button" disabled={!saved || Boolean(error)} onClick={exportFile}>Pobierz BPMN 2.0</button>
    </div>
    {previewVisible && <Suspense fallback={<p role="status">Przygotowuję podgląd BPMN…</p>}><BpmnPreview key={snapshot} steps={steps} externalSteps={externalSteps} scope={bpmnScope} variant={variant} /></Suspense>}
    {message && <p role="status">{message}</p>}
  </section>
}
