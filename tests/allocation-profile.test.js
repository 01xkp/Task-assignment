import assert from 'node:assert/strict'
import test from 'node:test'
import { developers } from '../server/storage.js'
import { eligibleDevelopersForTask, normalizeAllocationProfile, taskDiscipline } from '../shared/allocation-profile.js'

test('defaults legacy PRDs to every frontend developer and no backend work', () => {
  assert.deepEqual(normalizeAllocationProfile(undefined, developers), {
    frontendDeveloperIds: ['xiang-kunpeng', 'zeng-yuqiu', 'zhang-xu'],
    includeBackend: false,
    backendOwnerId: '',
  })
})

test('keeps a single selected backend owner for a feature', () => {
  assert.deepEqual(normalizeAllocationProfile({
    frontendDeveloperIds: ['zeng-yuqiu'],
    includeBackend: true,
    backendOwnerId: 'shu-jie',
  }, developers), {
    frontendDeveloperIds: ['zeng-yuqiu'],
    includeBackend: true,
    backendOwnerId: 'shu-jie',
  })
})

test('rejects backend ownership by a frontend member', () => {
  assert.throws(() => normalizeAllocationProfile({
    frontendDeveloperIds: ['zeng-yuqiu'],
    includeBackend: true,
    backendOwnerId: 'zeng-yuqiu',
  }, developers), { code: 'ALLOCATION_PROFILE_INVALID' })
})

test('rejects duplicate frontend developer IDs', () => {
  assert.throws(() => normalizeAllocationProfile({
    frontendDeveloperIds: ['zeng-yuqiu', 'zeng-yuqiu'],
    includeBackend: false,
  }, developers), { code: 'ALLOCATION_PROFILE_INVALID' })
})

test('classifies backend work and only returns matching developer candidates', () => {
  assert.equal(taskDiscipline({ workType: '后端实现' }), 'backend')
  assert.deepEqual(
    eligibleDevelopersForTask({ deliveryType: 'backend' }, developers).map((developer) => developer.name),
    ['舒杰', '陈远志'],
  )
})
