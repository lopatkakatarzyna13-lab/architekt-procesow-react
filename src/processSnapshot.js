export function buildProcessSnapshot({
  existingProcess,
  id,
  name,
  savedAt,
  lastScreen,
  sections,
}) {
  return {
    ...existingProcess,
    id,
    name,
    savedAt,
    lastScreen,
    sections: {
      ...existingProcess?.sections,
      scope: sections.scope,
      asIs: sections.asIs,
      analysis: sections.analysis,
      toBe: sections.toBe,
      report: sections.report,
    },
  }
}
