import { useState } from 'react'
import { getDecisionBpmnError } from './bpmnDecisionValidation'

export default function BpmnExport({ steps, scope, saved }) {
  const [message, setMessage] = useState('')
  const error = getDecisionBpmnError(steps)
  const exportFile = async () => {
    if (!saved || error) return
    try {
      const { createDecisionBpmn } = await import('./bpmnDecisionExport')
      const xml = await createDecisionBpmn({ steps, processName: scope.processName, startName: scope.processStart, endName: scope.processEnd })
      const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'proces-asis.bpmn'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Plik BPMN został przygotowany do pobrania.')
    } catch { setMessage('Nie udało się przygotować pliku BPMN. Spróbuj ponownie.') }
  }
  return <section className="step-connections" aria-labelledby="bpmn-export-title">
    <h2 id="bpmn-export-title">Eksport procesu BPMN 2.0</h2>
    <p>Eksport obejmuje nazwę procesu, początek, nazwy zadań, koniec, połączenia oraz określone przez Ciebie bramki wyboru jednej ścieżki. Role, systemy, opisy, ustalenia i inne dane nie są uwzględniane. Plik nie jest przeznaczony do automatycznego wykonywania procesu.</p>
    <p>Dla dodatkowych przejść uzupełnij decyzję i warunek podstawowej ścieżki. Opisy warunków nie są regułami do automatycznego wykonania. Bramki są w pobranym pliku; obecna mapa w aplikacji nadal jest poglądowa. Sprawdź model przed użyciem.</p>
    {!saved && <p>Najpierw zapisz proces AS-IS.</p>}
    {error && <p>{error}</p>}
    <button type="button" className="back-button" disabled={!saved || Boolean(error)} onClick={exportFile}>Pobierz BPMN 2.0</button>
    {message && <p role="status">{message}</p>}
  </section>
}
