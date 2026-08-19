export const workTypes = ['共享实现', '平台适配', '平台验收']

export function groupTasksByPrd(prds, tasks, { includeEmpty = false } = {}) {
  return prds.map((prd) => {
    const prdTasks = tasks.filter((task) => task.prdId === prd.id)
    return {
      prd,
      tasks: prdTasks,
      categories: workTypes
        .map((workType) => ({ workType, tasks: prdTasks.filter((task) => task.workType === workType) }))
        .filter((category) => category.tasks.length),
    }
  }).filter((group) => includeEmpty || group.tasks.length)
}
