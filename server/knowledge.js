function tokens(value) {
  return new Set(
    String(value || '')
      .toLowerCase()
      .match(/[\p{Script=Han}]{1,4}|[a-z0-9_-]{2,}/gu) || [],
  )
}

function score(entry, queryTokens) {
  const haystack = tokens(`${entry.taskTitle} ${entry.module} ${entry.reason} ${entry.fromAssignee} ${entry.toAssignee}`)
  let overlap = 0
  for (const token of queryTokens) {
    if (haystack.has(token)) overlap += 1
  }
  const ageDays = Math.max(0, (Date.now() - new Date(entry.createdAt).getTime()) / 86400000)
  return overlap * 10 + Math.max(0, 5 - ageDays / 14)
}

export function retrieveKnowledge(entries, query, limit = 12) {
  const queryTokens = tokens(query)
  return [...entries]
    .map((entry) => ({ entry, relevance: score(entry, queryTokens) }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit)
    .map(({ entry }) => entry)
}

export function formatKnowledge(entries) {
  if (!entries.length) return '暂无历史调整记录。'
  return entries
    .map((entry, index) => {
      const movement = entry.toAssignee
        ? `${entry.fromAssignee || '未分配'} -> ${entry.toAssignee}`
        : `${entry.fromAssignee || '未分配'} 拒绝`
      return `${index + 1}. [${entry.module || '未分类'}] ${entry.taskTitle}；${movement}；原因：${entry.reason}`
    })
    .join('\n')
}

