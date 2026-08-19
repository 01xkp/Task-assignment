export function isImportResultScreen(importResult, batchSummary, { mode = '', analyzing = false } = {}) {
  return Boolean(importResult || batchSummary || (mode === 'library' && analyzing))
}
