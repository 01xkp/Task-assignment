import assert from 'node:assert/strict'
import test from 'node:test'
import { groupTasksByPrd } from '../src/task-groups.js'

const prds = [
  { id: 'prd-new', title: '最新需求' },
  { id: 'prd-old', title: '历史需求' },
]

const task = (overrides = {}) => ({
  id: 'task-1',
  prdId: 'prd-new',
  title: '实现登录',
  workType: '共享实现',
  ...overrides,
})

test('keeps PRD order and nests tasks by work type', () => {
  const groups = groupTasksByPrd(prds, [
    task({ id: 'task-platform', workType: '平台适配' }),
    task({ id: 'task-shared', workType: '共享实现' }),
  ], { includeEmpty: true })

  assert.deepEqual(groups.map((group) => group.prd.id), ['prd-new', 'prd-old'])
  assert.deepEqual(groups[0].categories.map((category) => category.workType), ['共享实现', '平台适配'])
  assert.equal(groups[1].tasks.length, 0)
})

test('hides PRD parents without matching tasks when filters are active', () => {
  const groups = groupTasksByPrd(prds, [task()], { includeEmpty: false })

  assert.deepEqual(groups.map((group) => group.prd.id), ['prd-new'])
})
