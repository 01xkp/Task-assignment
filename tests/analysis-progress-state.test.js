import assert from 'node:assert/strict'
import test from 'node:test'
import { progressDetail } from '../src/analysis-progress-state.js'

test('explains that an accepted model request is still reasoning', () => {
  assert.equal(
    progressDetail({ waitingForOutput: true, heartbeat: false, message: '模型已接受请求，正在高强度推理' }),
    '模型已接受请求，正在高强度推理；尚未返回任务正文',
  )
})

test('marks a heartbeat as a live connection without changing completion', () => {
  assert.equal(
    progressDetail({ waitingForOutput: true, heartbeat: true, message: '模型已接受请求，正在高强度推理' }),
    '模型仍在推理，连接保持中；尚未返回任务正文',
  )
})
