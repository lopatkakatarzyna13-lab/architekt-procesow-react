import { describeNextTarget } from './processConnections.js'
import BpmnStepSummary from './BpmnStepSummary'
import { bpmnStepFields, getBpmnDocuments } from './bpmnStepDetails'
import { getBpmnMessages, getExternalActionPool, getExternalPools } from './bpmnMessages.js'

export default function PrintBpmnDetails({ steps, externalSteps, externalLinks = [], svg, error, variant = 'AS-IS' }) {
  const messages = getBpmnMessages(steps)
  const pools = getExternalPools(messages)
  const poolNames = new Map(pools)
  const endpoint = (pool, id) => [poolNames.get(pool) ?? pool, externalSteps.find((step) => step.id === id)?.name].filter(Boolean).join(' / ')
  const extra = steps.flatMap((step) => (step.extraConnections || []).map((link) => ({ sourceId: step.id, from: step.name, to: steps.find((item) => item.id === link.targetId)?.name || 'Nieznany krok', label: link.label })))
  const decisions = steps.filter((step) => step.extraConnections?.length && step.bpmnDecision)
  const overrides = steps.filter((step) => step.nextStepId)
  const detailed = steps.some((step) => step.bpmnTaskType || getBpmnDocuments(step).length || bpmnStepFields.some(([id]) => step[id]))
  return <div className="print-bpmn-details">
    <div className={svg ? 'print-map-block print-bpmn-sheet' : 'print-map-block'}>
      <div className="print-bpmn-figure">
        <h3>Mapa BPMN {variant}</h3>
        {svg ? <><p>Diagram odpowiada zapisanemu modelowi BPMN {variant}. Szczegóły połączeń podano poniżej. Diagram: bpmn.io.</p><img className={variant === 'TO-BE' ? 'print-bpmn-image print-tobe-bpmn' : 'print-bpmn-image'} src={svg} alt={`Mapa BPMN procesu ${variant}`} /></> : <p>Nie zamieszczono diagramu BPMN: {error || 'model nie jest dostępny'}.</p>}
      </div>
      {svg && decisions.length > 0 && <ul className="print-bpmn-branch-guide">
        {decisions.map((step) => <li key={step.id}>
          <strong>{step.bpmnDecision.question}</strong>
          <ul>
            <li>{step.bpmnDecision.mainLabel} → {step.nextStepId
              ? describeNextTarget(steps, step)
              : steps[steps.indexOf(step) + 1]?.name || 'Koniec procesu'}</li>
            {extra.filter((transition) => transition.sourceId === step.id).map(({ to, label }, index) =>
              <li key={index}>{label} → {to}</li>)}
          </ul>
        </li>)}
      </ul>}
    </div>
    {detailed && <>
      <h4>Szczegóły kroków BPMN {variant}</h4>
      <ol className="print-bpmn-step-list">{steps.map((step) => <li key={step.id}><strong>{step.name}</strong><BpmnStepSummary step={step} /></li>)}</ol>
    </>}
    {decisions.length > 0 && <><h4>Decyzje i ścieżki podstawowe</h4><ul>{decisions.map((step) => <li key={step.id}>{step.name}: {step.bpmnDecision.question} — ścieżka podstawowa: {step.bpmnDecision.mainLabel}</li>)}</ul></>}
    {overrides.length > 0 && <><h4>Przebieg podstawowy poza kolejnością listy</h4><ul>{overrides.map((step) =>
      <li key={step.id}>{step.name} → {describeNextTarget(steps, step)}</li>)}</ul></>}
    {extra.length > 0 && <><h4>Dodatkowe przejścia</h4><ul>{extra.map((item, index) => <li key={index}>{item.from} → {item.to}: {item.label}</li>)}</ul></>}
    {messages.length > 0 && <><h4>Baseny i wiadomości</h4><p>Basen własny: {messages[0].primary}. Baseny zewnętrzne: {pools.map(([, name]) => name).join(', ')}.</p><ul>{messages.map((message) => {
      const own = steps.find((step) => step.id === message.stepId)?.name || 'Nieznany krok'
      const external = externalSteps.find((step) => step.id === message.externalStepId)?.name || message.external
      return <li key={`${message.stepId}-${message.index}`}>{message.direction === 'outgoing' ? own : external} → {message.direction === 'outgoing' ? external : own}: {message.label}</li>
    })}</ul></>}
    {externalLinks.length > 0 && <>
      <h4>Przekazania między uczestnikami zewnętrznymi</h4>
      <ul>{externalLinks.map(({ source, target, sourceActionId, targetActionId, label }, index) => (
        <li key={index}>{endpoint(source, sourceActionId)} → {endpoint(target, targetActionId)} — {label}</li>
      ))}</ul>
    </>}
    {externalSteps.length > 0 && <><h4>Działania uczestników zewnętrznych</h4>{pools.map(([key, name]) => {
      const actions = externalSteps.filter((action) => getExternalActionPool(action, messages, pools) === key)
      return actions.length > 0 && <div key={key}><p>{name}</p><ol>{actions.map((action) => <li key={action.id}>{action.name}</li>)}</ol></div>
    })}</>}
  </div>
}
