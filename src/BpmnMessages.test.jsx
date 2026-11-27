// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BpmnMessages from './BpmnMessages.jsx'

afterEach(cleanup)

const asIsSteps = [{
  id: 'old-step',
  name: 'Wyślij skierowanie e-mailem',
  bpmnMessages: [{
    primary: 'Firma',
    external: 'Poradnia',
    direction: 'outgoing',
    label: 'Skierowanie',
    externalStepId: 'old-action',
  }],
}]

it('przygotowuje edytowalną wiadomość na powiązanym kroku z danymi bieżącej mapy', async () => {
  const user = userEvent.setup()
  const onAdd = vi.fn()
  const onDraftChange = vi.fn()
  const steps = [{ id: 'new-step', name: 'Udostępnij w portalu', sourceAsIsStepId: 'old-step' }]
  render(<BpmnMessages variant="TO-BE" steps={steps} asIsSteps={asIsSteps} organizationName="Proces HR"
    externalSteps={[{ id: 'new-action', name: 'Pobierz z portalu' }]} onAdd={onAdd} onDraftChange={onDraftChange} />)

  await user.click(screen.getByText('Użyj wiadomości z AS-IS'))
  const reuse = screen.getByRole('button', { name: /^Skierowanie — do Poradnia/ })
  await user.click(reuse)
  expect(screen.getByLabelText('Krok w Twoim procesie').value).toBe('new-step')
  expect(screen.getByLabelText('Nazwa basenu Twojego procesu').value).toBe('Proces HR')
  expect(screen.getByLabelText('Działanie uczestnika zewnętrznego (opcjonalnie)').value).toBe('')
  expect(reuse.disabled).toBe(true)
  expect(onAdd).not.toHaveBeenCalled()
  expect(onDraftChange).toHaveBeenLastCalledWith('message-form', true)

  const label = screen.getByLabelText('Co jest przekazywane?')
  await user.clear(label)
  await user.type(label, 'Skierowanie elektroniczne')
  await user.selectOptions(screen.getByLabelText('Działanie uczestnika zewnętrznego (opcjonalnie)'), 'new-action')
  await user.click(screen.getByRole('button', { name: 'Dodaj wiadomość BPMN' }))
  expect(onAdd).toHaveBeenCalledExactlyOnceWith('new-step', 'Proces HR', 'Poradnia', 'outgoing', 'Skierowanie elektroniczne', 'new-action')
  expect(onDraftChange).toHaveBeenLastCalledWith('message-form', false)
})

it('chroni rozpoczęty formularz i pozostawia wybór dla kroku bez powiązania', async () => {
  const user = userEvent.setup()
  render(<BpmnMessages variant="TO-BE" steps={[{ id: 'new-step', name: 'Udostępnij w portalu' }]}
    asIsSteps={asIsSteps} onDraftChange={vi.fn()} />)

  await user.click(screen.getByText('Użyj wiadomości z AS-IS'))
  const reuse = screen.getByRole('button', { name: /^Skierowanie — do Poradnia/ })
  const external = screen.getByLabelText('Nazwa basenu zewnętrznego')
  await user.type(external, 'Własny szkic')
  expect(reuse.disabled).toBe(true)
  await user.click(reuse)
  expect(external.value).toBe('Własny szkic')
  await user.click(screen.getByRole('button', { name: 'Wyczyść formularz wiadomości' }))
  await user.click(reuse)
  expect(screen.getByLabelText('Krok w Twoim procesie').value).toBe('')
  expect(screen.getByLabelText('Nazwa basenu Twojego procesu').value).toBe('Firma')
  expect(external.value).toBe('Poradnia')
})
