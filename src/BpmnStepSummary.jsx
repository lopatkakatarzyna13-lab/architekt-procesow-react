import { getBpmnStepDetails } from './bpmnStepDetails'

export default function BpmnStepSummary({ step }) {
  const details = getBpmnStepDetails(step)
  if (!details.length) return <p>Uzupełnij szczegóły w edycji kroku.</p>
  return <dl className="bpmn-step-summary">{details.map(([label, value], index) => (
    <div key={index}><dt>{label}</dt><dd>{value}</dd></div>
  ))}</dl>
}
