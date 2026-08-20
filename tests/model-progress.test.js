import assert from 'node:assert/strict'
import test from 'node:test'
import * as modelProgress from '../server/model-progress.js'
import { progressDetail } from '../src/analysis-progress-state.js'

const { modelLifecycleProgress } = modelProgress

test('reports that the gateway accepted a Responses request', () => {
  assert.deepEqual(modelLifecycleProgress('response.created'), {
    accepted: true,
    waitingForOutput: true,
  })
})

test('does not invent lifecycle state for task text deltas', () => {
  assert.equal(modelLifecycleProgress('response.output_text.delta'), null)
})

test('clears a heartbeat when accepted or text progress arrives', () => {
  assert.equal(typeof modelProgress.mergeAnalysisProgress, 'function')

  const heartbeat = modelProgress.mergeAnalysisProgress(
    { stage: 'draft-accepted', message: '模型已接受请求，正在高强度推理', waitingForOutput: true },
    { heartbeat: true, waitingForOutput: true },
  )
  const accepted = modelProgress.mergeAnalysisProgress(heartbeat, {
    stage: 'review-accepted',
    message: '模型已接受复核请求，正在高强度推理',
    waitingForOutput: true,
  })
  const text = modelProgress.mergeAnalysisProgress(heartbeat, {
    stage: 'review',
    message: '正在校验任务覆盖、主责平台和验收标准',
    waitingForOutput: false,
  })

  assert.equal(heartbeat.heartbeat, true)
  assert.equal(accepted.heartbeat, false)
  assert.equal(progressDetail(accepted), '模型已接受复核请求，正在高强度推理；尚未返回任务正文')
  assert.equal(text.heartbeat, false)
  assert.equal(progressDetail(text), '正在校验任务覆盖、主责平台和验收标准')
})
