import { describe, expect, it } from 'vitest'
import { applyRoleLanes, proposeRoleLanes } from './roleLanes.js'

describe('tory BPMN według wykonawców', () => {
  it('grupuje zapis tej samej roli, zachowuje inne role i istniejące połączenia', () => {
    const steps = [{ id: 'a', owner: 'Kadry', nextStepId: 'c' }, { id: 'b', owner: ' kadry ' }, { id: 'c', owner: 'HR' }]
    const result = applyRoleLanes(steps)
    expect(result.map((step) => step.bpmnLane)).toEqual(['Kadry', 'Kadry', 'HR'])
    expect(result[0].nextStepId).toBe('c')
    expect(steps[0].bpmnLane).toBeUndefined()
    expect(applyRoleLanes(result)).toBe(result)
  })

  it('wykorzystuje potwierdzone przypisanie i zachowuje ręczny tor', () => {
    const saved = { id: 'a', owner: 'Specjalista HR', bpmnLane: 'Kadry' }
    const result = applyRoleLanes([saved, { id: 'b', owner: 'specjalista hr' }])
    expect(result[0]).toBe(saved)
    expect(result[1].bpmnLane).toBe('Kadry')
  })

  it('wskazuje niejednoznaczną rolę, brak roli i zbyt długą nazwę bez częściowego zapisu', () => {
    const steps = [{ id: 'a', owner: 'HR', bpmnLane: 'Kadry' }, { id: 'b', owner: 'HR', bpmnLane: 'Płace' },
      { id: 'c', owner: 'HR' }, { id: 'd' }, { id: 'e', owner: 'X'.repeat(81) }, { id: 'f', owner: 'IT' }]
    const plan = proposeRoleLanes(steps)
    expect(plan.get('c').reason).toMatch(/kilka/)
    expect(plan.get('d').reason).toMatch(/Brak wykonawcy/)
    expect(plan.get('e').reason).toMatch(/80/)
    expect(() => applyRoleLanes(steps)).toThrow(/rozstrzygnij/)
    expect(steps.at(-1)).not.toHaveProperty('bpmnLane')
  })

  it('rozpoznaje nazwanych uczestników zewnętrznych w wiadomościach i działaniach', () => {
    const steps = [{ id: 'a', owner: 'BIURO', bpmnMessages: [{ external: 'Biuro' }] }, { id: 'b', owner: 'Klinika' }]
    const plan = proposeRoleLanes(steps, [{ participant: 'Klinika' }])
    expect([...plan.values()].every((item) => item.reason.includes('basen'))).toBe(true)
  })

  it('wymaga rozstrzygnięcia wykonawcy opisanego kilkoma rolami', () => {
    expect(proposeRoleLanes([{ id: 'a', owner: 'Kadry lub kierownik' }]).get('a').reason).toMatch(/jedną rolę/)
  })
})
