export function isImportResultScreen(importResult, batchSummary, { mode = '', analyzing = false } = {}) {
  return Boolean(importResult || batchSummary || (mode === 'library' && analyzing))
}

export function shouldShowFeatureAllocation(mode, importResult, { resultScreen = false } = {}) {
  return (mode === 'library' && !resultScreen) || Boolean(importResult?.imported?.length)
}
