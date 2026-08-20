import assert from 'node:assert/strict'
import test from 'node:test'
import { modelLifecycleProgress } from '../server/model-progress.js'

test('reports that the gateway accepted a Responses request', () => {
  assert.deepEqual(modelLifecycleProgress('response.created'), {
    accepted: true,
    waitingForOutput: true,
  })
})

test('does not invent lifecycle state for task text deltas', () => {
  assert.equal(modelLifecycleProgress('response.output_text.delta'), null)
})
