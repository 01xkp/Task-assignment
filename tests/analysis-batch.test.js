import assert from 'node:assert/strict'
import test from 'node:test'
import { runSequentialAnalysis, uniquePrdIds } from '../server/analysis-batch.js'

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
