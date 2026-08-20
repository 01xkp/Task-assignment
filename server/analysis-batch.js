import { groupPrdsByFeature } from '../shared/feature-modules.js'

export function uniquePrdIds(values) {
  const seen = new Set()
  return (Array.isArray(values) ? values : []).filter((value) => {
    const id = String(value || '').trim()
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function featureGroupsForPrdIds(prds, prdIds) {
  const prdsById = new Map((Array.isArray(prds) ? prds : []).map((prd) => [prd.id, prd]))
  const selectedPrds = uniquePrdIds(prdIds).map((prdId) => prdsById.get(prdId)).filter(Boolean)
  return groupPrdsByFeature(selectedPrds)
}

export async function runSequentialAnalysis(prdIds, analyze) {
  const succeeded = []
  const failed = []

  for (const id of uniquePrdIds(prdIds)) {
    try {
      succeeded.push({ id, result: await analyze(id) })
    } catch (error) {
      failed.push({ id, error: error.message || '分析失败', code: error.code || 'REQUEST_FAILED' })
    }
  }

  return { succeeded, failed }
}

export async function runSequentialFeatureAnalysis(groups, analyze) {
  const seen = new Set()
  const succeeded = []
  const failed = []

  for (const group of Array.isArray(groups) ? groups : []) {
    const featureKey = String(group?.featureKey || '').trim()
    if (!featureKey || seen.has(featureKey)) continue
    seen.add(featureKey)
    const item = {
      featureKey,
      featureName: String(group.featureName || featureKey),
      prdIds: [...new Set((group.prdIds || []).filter(Boolean))],
    }
    try {
      succeeded.push({ ...item, result: await analyze({ ...group, ...item }) })
    } catch (error) {
      failed.push({ ...item, error: error.message || '分析失败', code: error.code || 'REQUEST_FAILED' })
    }
  }

  return { succeeded, failed }
}
