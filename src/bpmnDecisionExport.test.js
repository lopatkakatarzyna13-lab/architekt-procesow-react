import { describe, expect, it } from 'vitest'
import { BpmnModdle } from 'bpmn-moddle'
import { createDecisionBpmn, getDecisionBpmnError } from './bpmnDecisionExport'

const steps = () => [
  { id: 'a', name: 'Uzupełnienie' },
  { id: 'b', name: 'Kontrola', extraConnections: [{ targetId: 'a', label: 'Brak danych' }], bpmnDecision: { question: 'Kompletne?', mainLabel: 'Tak' } },
  { id: 'c', name: 'Zatwierdzenie' },
]

describe('explicit BPMN decisions', () => {
  it('keeps a split and its return path clear of an expanded report task', async () => {
    const input = steps().map((step) => ({ ...step, bpmnLane: 'HR' }))
    const xml = await createDecisionBpmn({
      steps: input,
      getTaskSize: (name) => name === 'Kontrola' ? { width: 152, height: 180 } : { width: 100, height: 80 },
    })
    const { rootElement, warnings } = await new BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const elements = rootElement.diagrams[0].plane.planeElement
    const item = (id) => elements.find(({ bpmnElement }) => bpmnElement.id === id)
    const task = item('Task_2').bounds
    expect(item('Decision_2').bounds.x).toBeGreaterThan(task.x + task.width)
    expect(task.y + task.height).toBeLessThan(item('Lane_1').bounds.y + item('Lane_1').bounds.height)
    const returnFlow = elements.find(({ bpmnElement }) => bpmnElement.name === 'Brak danych')
    expect(returnFlow.waypoint[1].y).toBeLessThan(task.y)
  })

  it('creates named exclusive split, merge and the requested return with diagram coordinates', async () => {
    const { rootElement, warnings } = await new BpmnModdle().fromXML(await createDecisionBpmn({ steps: steps(), processName: 'Fikcyjny proces' }))
    expect(warnings).toEqual([])
    const process = rootElement.rootElements[0]
    expect(process.isExecutable).toBe(false)
    const decision = process.flowElements.find((item) => item.id === 'Decision_2')
    const merge = process.flowElements.find((item) => item.id === 'Merge_1')
    expect(decision.$type).toBe('bpmn:ExclusiveGateway')
    expect(decision.name).toBe('Kompletne?')
    expect(decision.outgoing.map((flow) => [flow.name, flow.targetRef.id])).toEqual([['Tak', 'Task_3'], ['Brak danych', 'Merge_1']])
    expect(merge.incoming).toHaveLength(2)
    expect(merge.outgoing[0].targetRef.id).toBe('Task_1')
    const plane = rootElement.diagrams[0].plane
    expect(plane.planeElement.some((item) => item.bpmnElement.id === decision.id)).toBe(true)
    const returnEdge = plane.planeElement.find((item) => item.bpmnElement?.name === 'Brak danych')
    expect(returnEdge.waypoint.length).toBeGreaterThan(2)
    const decisionBox = plane.planeElement.find((item) => item.bpmnElement?.id === decision.id).bounds
    const mergeBox = plane.planeElement.find((item) => item.bpmnElement?.id === merge.id).bounds
    expect(returnEdge.waypoint[0]).toMatchObject({ x: decisionBox.x + decisionBox.width / 2, y: decisionBox.y })
    expect(returnEdge.waypoint.at(-1)).toMatchObject({ x: mergeBox.x + mergeBox.width / 2, y: mergeBox.y })
  })
  it('exports explicitly assigned lanes and associates all nodes without altering connections', async () => {
    const input = steps().map((step, index) => ({ ...step, bpmnLane: index === 1 ? 'Biuro rachunkowe' : 'HR' }))
    const { rootElement, warnings } = await new BpmnModdle().fromXML(await createDecisionBpmn({ steps: input }))
    expect(warnings).toEqual([])
    const process = rootElement.rootElements[0]
    expect(process.laneSets).toHaveLength(1)
    const lanes = process.laneSets[0].lanes
    expect(lanes.map((lane) => lane.name)).toEqual(['HR', 'Biuro rachunkowe'])
    expect(lanes[0].flowNodeRef.map((node) => node.id)).toEqual(['StartEvent_1', 'Merge_1', 'Task_1', 'Task_3', 'EndEvent_1'])
    expect(lanes[1].flowNodeRef.map((node) => node.id)).toEqual(['Task_2', 'Decision_2'])
    expect(rootElement.diagrams[0].plane.planeElement.filter((shape) => shape.bpmnElement?.$type === 'bpmn:Lane')).toHaveLength(2)
    const decision = process.flowElements.find((element) => element.id === 'Decision_2')
    expect(decision.outgoing.map((flow) => [flow.name, flow.targetRef.id])).toEqual([['Tak', 'Task_3'], ['Brak danych', 'Merge_1']])
  })
  it('represents messages across two pools without sequence flows crossing participants', async () => {
    const input = steps().map((step, index) => ({ ...step, bpmnLane: index === 1 ? 'Kadry' : 'HR' }))
    input[0].bpmnMessages = [{ primary: 'Firma', external: 'Biuro', direction: 'outgoing', label: 'Dane pracownika' }]
    input[2].bpmnMessages = [{ primary: 'Firma', external: 'Biuro', direction: 'incoming', label: 'Dokumenty' }]
    const { rootElement, warnings } = await new BpmnModdle().fromXML(await createDecisionBpmn({ steps: input }))
    expect(warnings).toEqual([])
    const process = rootElement.rootElements.find((item) => item.$type === 'bpmn:Process')
    const collaboration = rootElement.rootElements.find((item) => item.$type === 'bpmn:Collaboration')
    expect(collaboration.participants.map((participant) => participant.name)).toEqual(['Firma', 'Biuro'])
    expect(collaboration.participants[0].processRef.id).toBe(process.id)
    expect(collaboration.participants[1].processRef).toBeUndefined()
    expect(collaboration.messageFlows.map((flow) => [flow.name, flow.sourceRef.id, flow.targetRef.id])).toEqual([
      ['Dane pracownika', 'Task_1', 'Participant_External_1'], ['Dokumenty', 'Participant_External_1', 'Task_3'],
    ])
    const ids = new Set(process.flowElements.map((item) => item.id))
    for (const flow of process.flowElements.filter((item) => item.$type === 'bpmn:SequenceFlow')) {
      expect(ids.has(flow.sourceRef.id) && ids.has(flow.targetRef.id)).toBe(true)
    }
    const plane = rootElement.diagrams[0].plane
    expect(plane.bpmnElement.id).toBe(collaboration.id)
    expect(plane.planeElement.filter((item) => item.bpmnElement?.$type === 'bpmn:Participant')).toHaveLength(2)
    expect(plane.planeElement.filter((item) => item.bpmnElement?.$type === 'bpmn:MessageFlow')).toHaveLength(2)
    const returnEdge = plane.planeElement.find((item) => item.bpmnElement?.name === 'Brak danych')
    const poolTop = plane.planeElement.find((item) => item.bpmnElement?.id === 'Participant_Main').bounds.y
    expect(returnEdge.waypoint[1].y - poolTop).toBeGreaterThanOrEqual(30)
  })
  it('exports explicitly ordered external actions and message endpoints while keeping sequence flows in their own pools', async () => {
    const input = steps()
    const externalSteps = [{ id: 'receive', name: 'Sprawdzenie danych' }, { id: 'prepare', name: 'Przygotowanie dokumentów' }]
    input[0].bpmnMessages = [{ primary: 'Firma', external: 'Biuro', direction: 'outgoing', label: 'Dane', externalStepId: 'receive' }]
    input[2].bpmnMessages = [{ primary: 'Firma', external: 'Biuro', direction: 'incoming', label: 'Dokumenty', externalStepId: 'prepare' }]
    const xml = await createDecisionBpmn({ steps: input, externalSteps })
    const { rootElement, warnings } = await new BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const collaboration = rootElement.rootElements.find((item) => item.$type === 'bpmn:Collaboration')
    const processes = collaboration.participants.map((item) => item.processRef)
    expect(processes[1].flowElements.filter((item) => item.$type === 'bpmn:Task').map((item) => item.name)).toEqual(['Sprawdzenie danych', 'Przygotowanie dokumentów'])
    expect(collaboration.messageFlows.map((item) => [item.sourceRef.id, item.targetRef.id])).toEqual([['Task_1', 'ExternalTask_1'], ['ExternalTask_2', 'Task_3']])
    for (const process of processes) {
      const nodes = new Set(process.flowElements)
      for (const flow of process.flowElements.filter((item) => item.$type === 'bpmn:SequenceFlow')) expect(nodes.has(flow.sourceRef) && nodes.has(flow.targetRef)).toBe(true)
    }
    expect(rootElement.diagrams[0].plane.planeElement.filter((item) => item.bpmnElement?.$type === 'bpmn:Task')).toHaveLength(5)
    expect(getDecisionBpmnError(input, [externalSteps[0]])).toMatch(/nieistniejące działanie/)
  })
  it('gives each message a separate label row between the participant pools', async () => {
    const input = steps()
    const externalSteps = [{ id: 'check', name: 'Kontrola' }, { id: 'create', name: 'Przygotowanie' }]
    input[0].bpmnMessages = [
      { primary: 'Firma', external: 'Biuro', direction: 'outgoing', label: 'Dane', externalStepId: 'check' },
      { primary: 'Firma', external: 'Biuro', direction: 'outgoing', label: 'Formularz' },
    ]
    input[2].bpmnMessages = [
      { primary: 'Firma', external: 'Biuro', direction: 'incoming', label: 'Dokument', externalStepId: 'create' },
      { primary: 'Firma', external: 'Biuro', direction: 'incoming', label: 'Potwierdzenie' },
    ]
    const { rootElement, warnings } = await new BpmnModdle().fromXML(await createDecisionBpmn({ steps: input, externalSteps }))
    expect(warnings).toEqual([])
    const elements = rootElement.diagrams[0].plane.planeElement
    const main = elements.find((item) => item.bpmnElement?.id === 'Participant_Main').bounds
    const external = elements.find((item) => item.bpmnElement?.id === 'Participant_External_1').bounds
    const edges = elements.filter((item) => item.bpmnElement?.$type === 'bpmn:MessageFlow')
    expect(edges).toHaveLength(4)
    const labels = edges.map((edge) => edge.label.bounds).sort((a, b) => a.y - b.y)
    expect(labels[0].y).toBeGreaterThan(main.y + main.height)
    expect(labels.at(-1).y + labels.at(-1).height).toBeLessThan(external.y)
    for (let i = 1; i < labels.length; i++) expect(labels[i].y).toBeGreaterThan(labels[i - 1].y + labels[i - 1].height)
    expect(edges[0].waypoint[0].x).not.toBe(edges[1].waypoint[0].x)
  })
  it('reserves room for long message names across multiple transfers', async () => {
    const input = steps()
    const externalSteps = [{ id: 'check', name: 'Sprawdzenie zgłoszenia i dokumentów' }]
    const labels = [
      'Dane pracownika i komplet dokumentów niezbędnych do przygotowania umowy',
      'Potwierdzenie poprawności danych oraz prośba o uzupełnienie brakujących informacji',
      'Informacja o zmianie warunków zatrudnienia i planowanej dacie rozpoczęcia pracy',
      'Projekt dokumentów pracowniczych do weryfikacji przez przedstawiciela firmy',
      'Odpowiedź na zgłoszone uwagi wraz z poprawionym kompletem dokumentów',
      'Potwierdzenie otrzymania i zakończenia weryfikacji dokumentów pracowniczych',
      'Zgłoszenie dodatkowej zmiany w danych osoby zatrudnionej',
      'Informacja zwrotna dotycząca wprowadzonych zmian i następnych działań',
    ]
    input[0].bpmnMessages = labels.map((label, index) => ({ primary: 'Firma', external: 'Biuro', direction: index % 2 ? 'incoming' : 'outgoing', label, externalStepId: 'check' }))
    const { rootElement, warnings } = await new BpmnModdle().fromXML(await createDecisionBpmn({ steps: input, externalSteps }))
    expect(warnings).toEqual([])
    const elements = rootElement.diagrams[0].plane.planeElement
    const main = elements.find((item) => item.bpmnElement?.id === 'Participant_Main').bounds
    const external = elements.find((item) => item.bpmnElement?.id === 'Participant_External_1').bounds
    const messages = elements.filter((item) => item.bpmnElement?.$type === 'bpmn:MessageFlow')
    expect(messages).toHaveLength(labels.length)
    const boxes = messages.map((item) => item.label.bounds).sort((a, b) => a.y - b.y)
    for (const [index, box] of boxes.entries()) {
      expect(box.height).toBeGreaterThan(44)
      expect(box.y).toBeGreaterThan(main.y + main.height)
      expect(box.y + box.height).toBeLessThan(external.y)
      if (index) expect(box.y).toBeGreaterThan(boxes[index - 1].y + boxes[index - 1].height)
    }
  })
  it('exports separate participants and blocks a message to an action in the wrong pool', async () => {
    const input = steps()
    input[0].bpmnMessages = [{ primary: 'Firma', external: 'Biuro', direction: 'outgoing', label: 'Dane' }]
    input[1].bpmnMessages = [{ primary: 'Firma', external: 'Bank', direction: 'incoming', label: 'Dokument' }]
    const externalSteps = [
      { id: 'office-action', name: 'Sprawdzenie dokumentów', participant: 'Biuro' },
      { id: 'bank-action', name: 'Zwrot potwierdzenia', participant: 'Bank' },
    ]
    input[1].bpmnMessages[0].externalStepId = 'bank-action'
    const externalLinks = [{ source: 'biuro', target: 'bank', label: 'Zlecenie' },
      { source: 'biuro', target: 'bank', label: 'Szczegóły', sourceActionId: 'office-action', targetActionId: 'bank-action' },
    ]
    expect(getDecisionBpmnError(input, externalSteps, [{ ...externalLinks[0], target: 'biuro' }])).toMatch(/dwa różne/)
    expect(getDecisionBpmnError(input, externalSteps, [{ ...externalLinks[0], target: 'nieznany' }])).toMatch(/istniejące baseny/)
    expect(getDecisionBpmnError(input, externalSteps, [{ ...externalLinks[1], sourceActionId: 'bank-action' }])).toMatch(/z innego basenu/)
    const xml = await createDecisionBpmn({ steps: input, externalSteps, externalLinks })
    const { rootElement, warnings } = await new BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const collaboration = rootElement.rootElements.find((item) => item.$type === 'bpmn:Collaboration')
    expect(collaboration.participants.slice(1).map(({ name, processRef }) => [
      name, processRef.flowElements.map((item) => item.name),
    ])).toEqual([['Biuro', ['Sprawdzenie dokumentów']], ['Bank', ['Zwrot potwierdzenia']]])
    expect(collaboration.messageFlows[1].sourceRef.name).toBe('Zwrot potwierdzenia')
    const directMessage = collaboration.messageFlows.find((flow) => flow.name === 'Zlecenie')
    expect(directMessage.sourceRef).toBe(collaboration.participants[1])
    expect(directMessage.targetRef).toBe(collaboration.participants[2])
    const detailedMessage = collaboration.messageFlows.find((flow) => flow.name === 'Szczegóły')
    expect(detailedMessage.sourceRef.name).toBe('Sprawdzenie dokumentów')
    expect(detailedMessage.targetRef.name).toBe('Zwrot potwierdzenia')
    input[1].bpmnMessages[0].externalStepId = 'office-action'
    expect(getDecisionBpmnError(input, externalSteps)).toMatch(/innego basenu/)
    input[1].bpmnMessages = [null]
    expect(getDecisionBpmnError(input)).toMatch(/Nieprawidłowe dane wiadomości/)
  })
  it('requires every step to have a lane when any lane is supplied', () => {
    const input = steps(); input[0].bpmnLane = 'HR'
    expect(getDecisionBpmnError(input)).toMatch(/Uzupełnij tor BPMN dla każdego kroku/)
    input[1].bpmnLane = 'HR'; input[2].bpmnLane = 'Biuro'
    expect(getDecisionBpmnError(input)).toBe('')
    input[1].bpmnLane = null
    expect(getDecisionBpmnError(input)).toMatch(/Nieprawidłowa nazwa toru/)
  })
  it('blocks export when user has not identified paths or when links are corrupt or ambiguous', () => {
    const missing = steps(); delete missing[1].bpmnDecision
    expect(getDecisionBpmnError(missing)).toMatch(/Uzupełnij decyzję/)
    const broken = steps(); broken[1].extraConnections[0].targetId = 'missing'
    expect(getDecisionBpmnError(broken)).toMatch(/Sprawdź dodatkowe/)
    const duplicate = steps(); duplicate[1].bpmnDecision.mainLabel = 'brak danych'
    expect(getDecisionBpmnError(duplicate)).toMatch(/muszą się różnić/)
    const malformed = steps(); malformed[1].extraConnections = null
    expect(getDecisionBpmnError(malformed)).toMatch(/Nieprawidłowe połączenia/)
  })
})
