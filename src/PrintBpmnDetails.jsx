import { getBpmnMessages } from './bpmnMessages'

export default function PrintBpmnDetails({ steps, externalSteps, svg, error, variant = 'AS-IS' }) {
  const messages = getBpmnMessages(steps)
  const extra = steps.flatMap((step) => (step.extraConnections || []).map((link) => ({ from: step.name, to: steps.find((item) => item.id === link.targetId)?.name || 'Nieznany krok', label: link.label })))
  const decisions = steps.filter((step) => step.extraConnections?.length && step.bpmnDecision)
  return <div className="print-bpmn-details">
    <h3>Mapa BPMN {variant}</h3>
    {svg ? <><p>Diagram odpowiada zapisanemu modelowi BPMN {variant}. Szczegóły połączeń podano poniżej. Diagram: bpmn.io.</p><img className={variant === 'TO-BE' ? 'print-bpmn-image print-tobe-bpmn' : 'print-bpmn-image'} src={svg} alt={`Mapa BPMN procesu ${variant}`} /></> : <p>Nie zamieszczono diagramu BPMN: {error || 'model nie jest dostępny'}.</p>}
    {decisions.length > 0 && <><h4>Decyzje i ścieżki podstawowe</h4><ul>{decisions.map((step) => <li key={step.id}>{step.name}: {step.bpmnDecision.question} — ścieżka podstawowa: {step.bpmnDecision.mainLabel}</li>)}</ul></>}
    {extra.length > 0 && <><h4>Dodatkowe przejścia</h4><ul>{extra.map((item, index) => <li key={index}>{item.from} → {item.to}: {item.label}</li>)}</ul></>}
    {messages.length > 0 && <><h4>Baseny i wiadomości</h4><p>Basen własny: {messages[0].primary}. Basen zewnętrzny: {messages[0].external}.</p><ul>{messages.map((message) => {
      const own = steps.find((step) => step.id === message.stepId)?.name || 'Nieznany krok'
      const external = externalSteps.find((step) => step.id === message.externalStepId)?.name || message.external
      return <li key={`${message.stepId}-${message.index}`}>{message.direction === 'outgoing' ? own : external} → {message.direction === 'outgoing' ? external : own}: {message.label}</li>
    })}</ul></>}
    {externalSteps.length > 0 && <><h4>Działania uczestnika zewnętrznego — kolejność</h4><ol>{externalSteps.map((step) => <li key={step.id}>{step.name}</li>)}</ol></>}
  </div>
}
