const terminalStatuses = new Set(['已完成', '已取消'])

function normalizeTaskPart(value) {
  return String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('zh-CN')
}

export function taskFingerprint(task) {
  return JSON.stringify([
    normalizeTaskPart(task.title),
    normalizeTaskPart(task.module),
    normalizeTaskPart(task.modulePath),
    normalizeTaskPart(task.workType),
    [...(task.platforms || [])].map(normalizeTaskPart).sort(),
  ])
}

export function reconcilePrdTasks(state, prdId, candidates) {
  const preserved = state.tasks.filter((task) => task.prdId !== prdId || terminalStatuses.has(task.status))
  const known = new Set(preserved.filter((task) => task.prdId === prdId).map(taskFingerprint))
  const saved = []

  for (const candidate of candidates) {
    const fingerprint = taskFingerprint(candidate)
    if (known.has(fingerprint)) continue
    known.add(fingerprint)
    saved.push(candidate)
  }

  state.tasks = [...saved, ...preserved]
  return { saved, taskCount: state.tasks.filter((task) => task.prdId === prdId).length }
}

function belongsToFeature(task, featureKey, prdIds) {
  if (task.featureKey === featureKey) return true
  if (prdIds.has(task.prdId)) return true
  return (task.sourcePrdIds || []).some((prdId) => prdIds.has(prdId))
}

export function reconcileFeatureTasks(state, { featureKey, prdIds, candidates }) {
  const sourcePrdIds = [...new Set((prdIds || []).filter(Boolean))]
  const sourceIds = new Set(sourcePrdIds)
  const belongs = (task) => belongsToFeature(task, featureKey, sourceIds)
  const preserved = state.tasks.filter((task) => !belongs(task) || terminalStatuses.has(task.status))
  const known = new Set(preserved.filter(belongs).map(taskFingerprint))
  const saved = []

  for (const candidate of candidates || []) {
    const task = {
      ...candidate,
      featureKey,
      sourcePrdIds,
      prdId: sourcePrdIds[0] || candidate.prdId,
    }
    const fingerprint = taskFingerprint(task)
    if (known.has(fingerprint)) continue
    known.add(fingerprint)
    saved.push(task)
  }

  state.tasks = [...saved, ...preserved]
  return { saved, taskCount: state.tasks.filter(belongs).length }
}

export function removePrdFromFeatureTasks(state, prdId) {
  let removed = 0
  const remaining = []

  for (const task of state.tasks) {
    const sourcePrdIds = Array.isArray(task.sourcePrdIds) ? task.sourcePrdIds.filter((id) => id !== prdId) : []
    if (!task.sourcePrdIds?.includes(prdId)) {
      if (task.prdId === prdId) {
        removed += 1
        continue
      }
      remaining.push(task)
      continue
    }
    if (!sourcePrdIds.length) {
      removed += 1
      continue
    }
    remaining.push({ ...task, sourcePrdIds, prdId: task.prdId === prdId ? sourcePrdIds[0] : task.prdId })
  }

  state.tasks = remaining
  return removed
}
