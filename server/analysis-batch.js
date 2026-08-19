export function uniquePrdIds(values) {
  const seen = new Set()
  return (Array.isArray(values) ? values : []).filter((value) => {
    const id = String(value || '').trim()
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
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
