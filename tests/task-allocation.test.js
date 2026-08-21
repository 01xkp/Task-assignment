import assert from 'node:assert/strict'
import test from 'node:test'
import { developers } from '../server/storage.js'
import { activeWorkloads, assertEligibleReassignment, eligibleReassignmentCandidates } from '../server/task-allocation.js'

test('counts active backend hours without counting terminal work', () => {
  const workloads = activeWorkloads({ tasks: [
    { id: 'active-backend', assignee: '舒杰', estimateHours: 8, status: '进行中' },
    { id: 'done-backend', assignee: '陈远志', estimateHours: 5, status: '已完成' },
    { id: 'active-frontend', assignee: '曾雨秋', estimateHours: 3, status: '待开始' },
  ] }, developers)

  assert.equal(workloads['舒杰'], 8)
  assert.equal(workloads['陈远志'], 0)
  assert.equal(workloads['曾雨秋'], 3)
})

test('never offers frontend developers for backend reassignment', () => {
  assert.deepEqual(
    eligibleReassignmentCandidates({ deliveryType: 'backend', assignee: '舒杰' }, developers).map((developer) => developer.name),
    ['陈远志'],
  )
})

test('never offers backend developers for frontend reassignment', () => {
  assert.deepEqual(
    eligibleReassignmentCandidates({ deliveryType: 'frontend', assignee: '曾雨秋' }, developers).map((developer) => developer.name),
    ['向坤朋', '张徐'],
  )
})

test('treats legacy backend work types as backend reassignment work', () => {
  assert.deepEqual(
    eligibleReassignmentCandidates({ workType: '后端实现', assignee: '陈远志' }, developers).map((developer) => developer.name),
    ['舒杰'],
  )
})

test('rejects a reassignment across frontend and backend disciplines', () => {
  assert.throws(
    () => assertEligibleReassignment({ deliveryType: 'backend', assignee: '舒杰' }, '曾雨秋', developers),
    { message: '请选择与任务类型匹配的开发者' },
  )
})
