import { eligibleDevelopersForTask } from '../shared/allocation-profile.js'

const terminalStatuses = new Set(['已完成', '已取消'])

export function activeWorkloads(state, developers, excludedTaskId = '') {
  return Object.fromEntries((developers || []).map((developer) => [
    developer.name,
    (state.tasks || [])
      .filter((task) => task.id !== excludedTaskId && task.assignee === developer.name && !terminalStatuses.has(task.status))
      .reduce((total, task) => total + Number(task.estimateHours || 0), 0),
  ]))
}

export function eligibleReassignmentCandidates(task, developers) {
  return eligibleDevelopersForTask(task, developers)
    .filter((developer) => developer.name !== task.assignee)
}

export function assertEligibleReassignment(task, assignee, developers) {
  if (!eligibleReassignmentCandidates(task, developers).some((developer) => developer.name === assignee)) {
    throw new Error('请选择与任务类型匹配的开发者')
  }
}
