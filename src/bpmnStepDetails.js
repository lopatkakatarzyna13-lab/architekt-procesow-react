export const bpmnTaskTypes = {
  manual: { label: 'Ręczne', element: 'bpmn:ManualTask' },
  user: { label: 'Człowiek w systemie', element: 'bpmn:UserTask' },
  service: { label: 'Systemowe', element: 'bpmn:ServiceTask' },
  send: { label: 'Wysyła wiadomość', element: 'bpmn:SendTask' },
  receive: { label: 'Czeka na wiadomość', element: 'bpmn:ReceiveTask' },
}

export const bpmnDocumentDirections = { input: 'Wejście', output: 'Wyjście' }

export const bpmnStepFields = [
  ['bpmnRequiredData', 'Wymagane dane'],
  ['bpmnRule', 'Reguła'],
  ['bpmnException', 'Wyjątek'],
  ['bpmnHumanCheck', 'Punkt kontroli człowieka'],
  ['bpmnFrequency', 'Częstotliwość'],
  ['bpmnDeadline', 'Termin wykonania'],
  ['bpmnWorkTime', 'Czas pracy'],
  ['bpmnWaitTime', 'Czas oczekiwania'],
]

export const emptyBpmnStep = {
  bpmnTaskType: '',
  bpmnDocuments: [],
  ...Object.fromEntries(bpmnStepFields.map(([key]) => [key, ''])),
}

export function getBpmnDocuments(step) {
  return Array.isArray(step.bpmnDocuments) ? step.bpmnDocuments : []
}

export function readBpmnStepDraft(step) {
  return {
    ...Object.fromEntries(bpmnStepFields.map(([key]) => [key, step[key] ?? ''])),
    bpmnTaskType: Object.hasOwn(bpmnTaskTypes, step.bpmnTaskType) ? step.bpmnTaskType : '',
    bpmnDocuments: getBpmnDocuments(step).map((document) => ({ ...document })),
  }
}

export function describeBpmnDocument({ name, format, channel }) {
  return [name, format && `format: ${format}`, channel && `kanał: ${channel}`].filter(Boolean).join(' · ')
}

export function getBpmnStepDetails(step) {
  return [
    ['Typ zadania BPMN', Object.hasOwn(bpmnTaskTypes, step.bpmnTaskType) ? bpmnTaskTypes[step.bpmnTaskType].label : ''],
    [step.bpmnTaskType === 'service' ? 'Odpowiedzialność biznesowa' : 'Wykonawca', step.owner],
    ['System', step.system],
    ['Opis', step.description],
    ['Rezultat', step.result],
    ...bpmnStepFields.map(([key, label]) => [label, step[key]]),
    ...getBpmnDocuments(step).map((document) => [bpmnDocumentDirections[document.direction], describeBpmnDocument(document)]),
  ].filter(([, value]) => typeof value === 'string' && value.trim())
}

export function getBpmnStepError(step) {
  if (step.bpmnDocuments === undefined) return ''
  if (!Array.isArray(step.bpmnDocuments) || step.bpmnDocuments.some((document) =>
    !document || !Object.hasOwn(bpmnDocumentDirections, document.direction)
    || typeof document.name !== 'string' || !document.name.trim()
    || [document.format, document.channel].some((value) => value !== undefined && typeof value !== 'string'),
  )) return 'Sprawdź nazwy oraz kierunek dodanych dokumentów BPMN.'
  return ''
}
