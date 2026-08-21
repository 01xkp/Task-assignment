import assert from 'node:assert/strict'
import test from 'node:test'
import { developers } from '../server/storage.js'
import { buildAllocationInstructions, createAllocationSchema, normalizeAllocationForProfile } from '../server/model.js'

const profileWithBackend = {
  frontendDeveloperIds: ['zeng-yuqiu'],
  includeBackend: true,
  backendOwnerId: 'shu-jie',
}

test('limits frontend names and emits one backend schema branch for the selected owner', () => {
  const schema = createAllocationSchema(profileWithBackend, developers)
  const branches = schema.properties.tasks.items.oneOf

  assert.deepEqual(branches[0].properties.suggestedAssignee.enum, ['曾雨秋'])
  assert.deepEqual(branches[1].properties.suggestedAssignee.enum, ['舒杰'])
  assert.match(buildAllocationInstructions(profileWithBackend, developers), /不得生成重复后端任务/)
  assert.match(buildAllocationInstructions(profileWithBackend, developers), /主责平台.*技能.*当前总工时/)
})

test('omits the backend task branch when a feature disables backend work', () => {
  const schema = createAllocationSchema({
    frontendDeveloperIds: ['zeng-yuqiu'],
    includeBackend: false,
    backendOwnerId: '',
  }, developers)

  assert.equal(schema.properties.tasks.items.oneOf.length, 1)
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
