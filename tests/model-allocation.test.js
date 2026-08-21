import assert from 'node:assert/strict'
import test from 'node:test'
import { developers } from '../server/storage.js'
import { buildAllocationInstructions, createAllocationSchema, normalizeAllocationForProfile } from '../server/model.js'

const profileWithBackend = {
  frontendDeveloperIds: ['zeng-yuqiu'],
  includeBackend: true,
  backendOwnerId: 'shu-jie',
}

const frontendCandidatesProfile = {
  frontendDeveloperIds: ['xiang-kunpeng', 'zeng-yuqiu'],
  includeBackend: false,
  backendOwnerId: '',
}

function frontendTask(overrides = {}) {
  return {
    title: '接入邀请码页面',
    description: '在注册流程接入邀请码校验',
    module: '邀请码',
    modulePath: 'lib/features/invite',
    workType: '共享实现',
    platforms: ['Android'],
    deliveryType: 'frontend',
    priority: '中',
    estimateHours: 4,
    suggestedAssignee: '向坤朋',
    reasoning: '测试夹具',
    acceptanceCriteria: ['可提交邀请码'],
    dependencies: [],
    ...overrides,
  }
}

test('limits task assignees to selected candidates without a frontend owner schema', () => {
  const schema = createAllocationSchema(profileWithBackend, developers)
  const branches = schema.properties.tasks.items.oneOf

  assert.deepEqual(schema.required, ['summary', 'tasks'])
  assert.equal(Object.hasOwn(schema.properties, 'frontendOwner'), false)
  assert.deepEqual(branches[0].properties.suggestedAssignee.enum, ['曾雨秋'])
  assert.deepEqual(branches[1].properties.suggestedAssignee.enum, ['舒杰'])
  assert.match(buildAllocationInstructions(profileWithBackend, developers), /不得生成重复后端任务/)
  assert.doesNotMatch(buildAllocationInstructions(profileWithBackend, developers), /frontendOwner|唯一前端主负责人/)
  assert.match(buildAllocationInstructions(profileWithBackend, developers), /不得依据.*主责平台/)
})

test('omits the backend task branch when a feature disables backend work', () => {
  const schema = createAllocationSchema({
    frontendDeveloperIds: ['zeng-yuqiu'],
    includeBackend: false,
    backendOwnerId: '',
  }, developers)

  assert.equal(schema.properties.tasks.items.oneOf.length, 1)
})

test('keeps valid task-level assignments across selected frontend candidates', () => {
  const schema = createAllocationSchema(frontendCandidatesProfile, developers)
  const result = normalizeAllocationForProfile({
    summary: '邀请码注册',
    tasks: [
      frontendTask({ suggestedAssignee: '向坤朋' }),
      frontendTask({ title: '验证邀请码状态', suggestedAssignee: '曾雨秋' }),
    ],
  }, frontendCandidatesProfile, developers)

  assert.deepEqual(schema.properties.tasks.items.oneOf[0].properties.suggestedAssignee.enum, ['向坤朋', '曾雨秋'])
  assert.deepEqual(result.allocationProfile, frontendCandidatesProfile)
  assert.equal(Object.hasOwn(result, 'frontendOwner'), false)
  assert.deepEqual(result.tasks.map((task) => task.suggestedAssignee), ['向坤朋', '曾雨秋'])
})

test('normalizes model output to the selected frontend team and backend owner', () => {
  const result = normalizeAllocationForProfile({
    summary: '邀请码注册',
    tasks: [
      {
        title: '新增邀请码接口', description: '写入邀请码', module: '邀请', modulePath: 'lib/features/invitations',
        workType: '共享实现', platforms: ['Android'], deliveryType: 'backend', priority: '高', estimateHours: 8,
        suggestedAssignee: '陈远志', reasoning: '错误候选人', acceptanceCriteria: ['接口可调用'], dependencies: [],
      },
      {
        title: '接入注册页面', description: '输入邀请码', module: '邀请', modulePath: 'lib/features/invitations',
        workType: '共享实现', platforms: ['Android'], deliveryType: 'frontend', priority: '中', estimateHours: 4,
        suggestedAssignee: '张徐', reasoning: '错误候选人', acceptanceCriteria: ['可提交'], dependencies: [],
      },
    ],
  }, profileWithBackend, developers)

  assert.deepEqual(result.tasks.map((task) => [task.deliveryType, task.workType, task.platforms, task.suggestedAssignee]), [
    ['backend', '后端实现', ['服务端'], '舒杰'],
    ['frontend', '共享实现', ['Android'], '曾雨秋'],
  ])
})
