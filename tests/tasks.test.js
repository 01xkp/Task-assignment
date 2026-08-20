import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileFeatureTasks, reconcilePrdTasks, removePrdFromFeatureTasks } from '../server/tasks.js'

const task = (overrides = {}) => ({
  id: 'task-1',
  prdId: 'prd-1',
  title: '实现登录',
  module: '认证',
  modulePath: 'lib/auth',
  workType: '共享实现',
  platforms: ['Android', 'iOS'],
  status: '待开始',
  ...overrides,
})

test('removes duplicate model tasks before saving', () => {
  const state = { tasks: [] }
  const result = reconcilePrdTasks(state, 'prd-1', [task(), task({ id: 'task-2' })])

  assert.equal(result.saved.length, 1)
  assert.equal(state.tasks.length, 1)
})

test('does not recreate a terminal task during reanalysis', () => {
  const state = {
    tasks: [
      task({ id: 'done', status: '已完成' }),
      task({ id: 'active', title: '旧任务', status: '进行中' }),
    ],
  }
  const result = reconcilePrdTasks(state, 'prd-1', [task({ id: 'new' })])

  assert.equal(result.saved.length, 0)
  assert.deepEqual(state.tasks.map((item) => item.id), ['done'])
})

test('replaces active tasks across all PRDs in one feature and saves one duplicate candidate', () => {
  const state = {
    tasks: [
      task({ id: 'old-a', prdId: 'prd-a', title: '旧开发任务' }),
      task({ id: 'old-b', prdId: 'prd-b', title: '旧验收任务' }),
      task({ id: 'done', prdId: 'prd-b', title: '已交付任务', status: '已完成' }),
      task({ id: 'other', prdId: 'prd-other', title: '其他功能' }),
    ],
  }

  const result = reconcileFeatureTasks(state, {
    featureKey: 'folder:内测邀请码注册-v2',
    prdIds: ['prd-a', 'prd-b'],
    candidates: [task({ id: 'new-a', title: '实现邀请码注册' }), task({ id: 'new-b', title: '实现邀请码注册' })],
  })

  assert.equal(result.saved.length, 1)
  assert.deepEqual(state.tasks.map((item) => item.id), ['new-a', 'done', 'other'])
  assert.deepEqual(state.tasks[0].sourcePrdIds, ['prd-a', 'prd-b'])
  assert.equal(state.tasks[0].featureKey, 'folder:内测邀请码注册-v2')
  assert.equal(result.taskCount, 2)
})

test('keeps shared feature tasks until their last source PRD is deleted', () => {
  const state = {
    tasks: [task({
      id: 'shared',
      prdId: 'prd-a',
      featureKey: 'folder:内测邀请码注册-v2',
      sourcePrdIds: ['prd-a', 'prd-b'],
    })],
  }

  assert.equal(removePrdFromFeatureTasks(state, 'prd-a'), 0)
  assert.deepEqual(state.tasks[0].sourcePrdIds, ['prd-b'])
  assert.equal(state.tasks[0].prdId, 'prd-b')
  assert.equal(removePrdFromFeatureTasks(state, 'prd-b'), 1)
  assert.deepEqual(state.tasks, [])
})
