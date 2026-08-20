const presentations = {
  ready: { label: '待分配', tone: 'ready' },
  analyzing: { label: '分配中', tone: 'analyzing' },
  completed: { label: '重新分配', tone: 'completed' },
  failed: { label: '分配失败', tone: 'failed' },
}

export function allocationStatusPresentation(status) {
  return presentations[status] || presentations.ready
}

export function allocationActionLabel(status) {
  if (status === 'analyzing') return '分配中'
  return status === 'ready' ? '开始分配' : '重新分配'
}
