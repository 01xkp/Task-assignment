function invalidProfile(message) {
  const error = new Error(message)
  error.code = 'ALLOCATION_PROFILE_INVALID'
  return error
}

function developerDiscipline(developer) {
  return developer?.discipline === 'backend' ? 'backend' : 'frontend'
}

export function developersByDiscipline(developers, discipline) {
  return (developers || []).filter((developer) => developerDiscipline(developer) === discipline)
}

export function defaultAllocationProfile(developers) {
  return {
    frontendDeveloperIds: developersByDiscipline(developers, 'frontend').map((developer) => developer.id),
    includeBackend: false,
    backendOwnerId: '',
  }
}

export function normalizeAllocationProfile(value, developers) {
  if (value == null) return defaultAllocationProfile(developers)
  if (typeof value !== 'object' || Array.isArray(value)) throw invalidProfile('分配档案格式无效')

  const frontendDeveloperIds = Array.isArray(value.frontendDeveloperIds)
    ? value.frontendDeveloperIds.map((id) => String(id || '').trim())
    : []
  const frontendIds = new Set(developersByDiscipline(developers, 'frontend').map((developer) => developer.id))
  const backendIds = new Set(developersByDiscipline(developers, 'backend').map((developer) => developer.id))
  const includeBackend = value.includeBackend === true
  const backendOwnerId = String(value.backendOwnerId || '').trim()

  if (!frontendDeveloperIds.length || frontendDeveloperIds.some((id) => !frontendIds.has(id))) {
    throw invalidProfile('请选择至少一位有效的前端开发人员')
  }
  if (new Set(frontendDeveloperIds).size !== frontendDeveloperIds.length) {
    throw invalidProfile('前端开发人员不能重复选择')
  }
  if (includeBackend && !backendIds.has(backendOwnerId)) {
    throw invalidProfile('启用后端任务时必须选择有效的后端负责人')
  }

  return { frontendDeveloperIds, includeBackend, backendOwnerId: includeBackend ? backendOwnerId : '' }
}

export function taskDiscipline(task) {
  return task?.deliveryType === 'backend' || task?.workType === '后端实现' ? 'backend' : 'frontend'
}

export function eligibleDevelopersForTask(task, developers) {
  return developersByDiscipline(developers, taskDiscipline(task))
}

export function isEligibleAssignee(task, developer) {
  return developerDiscipline(developer) === taskDiscipline(task)
}
