import assert from 'node:assert/strict'
import test from 'node:test'
import { runSequentialAnalysis, runSequentialFeatureAnalysis, uniquePrdIds } from '../server/analysis-batch.js'

test('removes empty and duplicate IDs while preserving selection order', () => {
  assert.deepEqual(uniquePrdIds(['prd-2', '', 'prd-1', 'prd-2']), ['prd-2', 'prd-1'])
})

test('continues after one queued analysis fails', async () => {
  const calls = []
  const result = await runSequentialAnalysis(['prd-1', 'prd-2'], async (id) => {
    calls.push(id)
    if (id === 'prd-1') throw Object.assign(new Error('timeout'), { code: 'MODEL_TIMEOUT' })
    return { id, tasks: [] }
  })

  assert.deepEqual(calls, ['prd-1', 'prd-2'])
  assert.equal(result.failed[0].id, 'prd-1')
  assert.equal(result.succeeded[0].id, 'prd-2')
})

test('runs each feature once and continues after a feature failure', async () => {
  const calls = []
  const result = await runSequentialFeatureAnalysis([
    { featureKey: 'folder:invite', featureName: '邀请码注册', prdIds: ['prd-a', 'prd-b'] },
    { featureKey: 'folder:invite', featureName: '邀请码注册', prdIds: ['prd-a', 'prd-b'] },
    { featureKey: 'prd:c', featureName: '独立需求', prdIds: ['prd-c'] },
  ], async (group) => {
    calls.push(group.featureKey)
    if (group.featureKey === 'folder:invite') throw Object.assign(new Error('timeout'), { code: 'MODEL_TIMEOUT' })
    return { taskCount: 3 }
  })

  assert.deepEqual(calls, ['folder:invite', 'prd:c'])
  assert.deepEqual(result.failed[0], {
    featureKey: 'folder:invite',
    featureName: '邀请码注册',
    prdIds: ['prd-a', 'prd-b'],
    error: 'timeout',
    code: 'MODEL_TIMEOUT',
  })
  assert.deepEqual(result.succeeded[0], {
    featureKey: 'prd:c',
    featureName: '独立需求',
    prdIds: ['prd-c'],
    result: { taskCount: 3 },
  })
})
