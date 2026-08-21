import { applyFeatureIdentity, groupPrdsByFeature } from '../shared/feature-modules.js'

export const workTypes = ['共享实现', '平台适配', '平台验收', '后端实现']

function latestPrd(prds) {
  return prds.reduce((latest, prd) => {
    const latestTime = latest?.updatedAt || latest?.createdAt || ''
    const prdTime = prd.updatedAt || prd.createdAt || ''
    return prdTime > latestTime ? prd : latest
  }, null)
}

export function groupTasksByFeature(prds, tasks, { includeEmpty = false } = {}) {
  const featureByPrdId = new Map((prds || []).map((prd) => {
    const feature = applyFeatureIdentity(prd)
    return [feature.id, feature.featureKey]
  }))

  return groupPrdsByFeature(prds).map((feature) => {
    const featureTasks = (tasks || []).filter((task) => {
      const taskFeatureKey = task.featureKey || featureByPrdId.get(task.prdId)
      return taskFeatureKey === feature.featureKey
    })
    const latest = latestPrd(feature.prds)
    return {
      ...feature,
      tasks: featureTasks,
      categories: workTypes
        .map((workType) => ({ workType, tasks: featureTasks.filter((task) => task.workType === workType) }))
        .filter((category) => category.tasks.length),
      updatedAt: latest?.updatedAt || latest?.createdAt || '',
      analysisStatus: latest?.analysisStatus || 'ready',
    }
  }).filter((feature) => includeEmpty || feature.tasks.length)
}
