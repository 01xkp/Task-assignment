import assert from 'node:assert/strict'
import test from 'node:test'
import { groupTasksByFeature } from '../src/task-groups.js'

const prds = [
  { id: 'prd-dev', title: '开发阅读版', sourceType: 'file', sourceLabel: '内测邀请码注册-v2/开发.md', updatedAt: '2026-08-20T08:00:00.000Z', analysisStatus: 'completed' },
  { id: 'prd-acceptance', title: '负责人验收', sourceType: 'file', sourceLabel: '内测邀请码注册-v2/验收.md', updatedAt: '2026-08-20T08:10:00.000Z', analysisStatus: 'completed' },
  { id: 'prd-other', title: '独立需求', sourceType: 'text', sourceLabel: '手动粘贴', updatedAt: '2026-08-20T07:00:00.000Z', analysisStatus: 'ready' },
]

const task = (overrides = {}) => ({
  id: 'task-1',
  prdId: 'prd-dev',
  title: '实现登录',
  workType: '共享实现',
  ...overrides,
})

test('merges legacy PRDs from one folder into a feature parent', () => {
  const groups = groupTasksByFeature(prds, [
    task({ id: 'task-platform', prdId: 'prd-acceptance', workType: '平台验收' }),
    task({ id: 'task-shared', prdId: 'prd-dev', workType: '共享实现' }),
  ], { includeEmpty: true })

  assert.deepEqual(groups.map((group) => group.featureKey), ['folder:内测邀请码注册-v2', 'prd:prd-other'])
  assert.equal(groups[0].featureName, '内测邀请码注册')
  assert.deepEqual(groups[0].prds.map((prd) => prd.id), ['prd-dev', 'prd-acceptance'])
  assert.deepEqual(groups[0].categories.map((category) => category.workType), ['共享实现', '平台验收'])
  assert.equal(groups[1].tasks.length, 0)
})

test('hides feature parents without matching tasks when filters are active', () => {
  const groups = groupTasksByFeature(prds, [task()], { includeEmpty: false })

  assert.deepEqual(groups.map((group) => group.featureKey), ['folder:内测邀请码注册-v2'])
})

test('renders backend work as a child category of its feature', () => {
  const groups = groupTasksByFeature(prds, [
    task({
      id: 'backend',
      workType: '后端实现',
      deliveryType: 'backend',
      platforms: ['服务端'],
      assignee: '舒杰',
    }),
  ])

  assert.deepEqual(groups[0].categories.map((category) => category.workType), ['后端实现'])
})
