export function toBeBpmnScope(scope) {
  return { processName: `${scope.processName?.trim() || 'Proces'} — TO-BE`, processStart: '', processEnd: '' }
}
