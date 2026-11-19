import { expect, it } from 'vitest'
import { completedProcessExportStem } from './processExportName'

it('makes process and version readable in a filename without platform-specific characters', () => {
  expect(completedProcessExportStem('Zgłoszenie / płace: Łódź?', 2)).toBe('zgloszenie-place-lodz-v2')
  expect(completedProcessExportStem('*/?', undefined)).toBe('proces-v1')
  expect(completedProcessExportStem(`${'a'.repeat(79)} bbbb`, 3)).toBe(`${'a'.repeat(79)}-v3`)
})
