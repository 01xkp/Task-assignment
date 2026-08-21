export function isImportResultScreen(importResult, batchSummary, { mode = '', analyzing = false } = {}) {
  return Boolean(importResult || batchSummary || (mode === 'library' && analyzing))
}

export function shouldShowFeatureAllocation(mode, importResult, { resultScreen = false } = {}) {
  return (mode === 'library' && !resultScreen) || Boolean(importResult?.imported?.length)
}

export function initialLibrarySelection(prds, initialPrdIds) {
  const existingIds = new Set((prds || []).map((prd) => String(prd?.id || '').trim()).filter(Boolean))
  const selected = new Set()
  return (initialPrdIds || []).flatMap((prdId) => {
    const id = String(prdId || '').trim()
    if (!existingIds.has(id) || selected.has(id)) return []
    selected.add(id)
    return [id]
  })
}
