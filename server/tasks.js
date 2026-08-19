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
