export function completedProcessExportStem(name, version) {
  const slug = (name ?? '')
    .toLowerCase()
    .replaceAll('ł', 'l')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  const versionNumber = Number.isSafeInteger(version) && version > 0 ? version : 1
  return `${slug || 'proces'}-v${versionNumber}`
}
