import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcilePrdTasks } from '../server/tasks.js'

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
