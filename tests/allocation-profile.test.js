import assert from 'node:assert/strict'
import test from 'node:test'
import { developers } from '../server/storage.js'
import { eligibleDevelopersForTask, normalizeAllocationProfile, profilesForFeatureGroups, taskDiscipline } from '../shared/allocation-profile.js'

test('defaults legacy PRDs to every frontend developer and no backend work', () => {
  assert.deepEqual(normalizeAllocationProfile(undefined, developers), {
    frontendDeveloperIds: ['xiang-kunpeng', 'zeng-yuqiu', 'zhang-xu'],
    includeBackend: false,
    backendOwnerId: '',
  })
})

test('ignores a legacy frontend owner and keeps the editable candidate pool', () => {
  assert.deepEqual(normalizeAllocationProfile({
    frontendDeveloperIds: ['xiang-kunpeng', 'zeng-yuqiu'],
    frontendOwnerId: 'zeng-yuqiu',
    includeBackend: false,
  }, developers), {
    frontendDeveloperIds: ['xiang-kunpeng', 'zeng-yuqiu'],
    includeBackend: false,
    backendOwnerId: '',
  })
})

test('ignores a legacy frontend owner outside the candidate pool', () => {
  assert.deepEqual(normalizeAllocationProfile({
    frontendDeveloperIds: ['zeng-yuqiu'],
    frontendOwnerId: 'xiang-kunpeng',
    includeBackend: false,
  }, developers), {
    frontendDeveloperIds: ['zeng-yuqiu'],
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

test('allows backend-only analysis without a frontend candidate', () => {
  assert.deepEqual(normalizeAllocationProfile({
    frontendDeveloperIds: [],
    includeBackend: true,
    backendOwnerId: 'shu-jie',
  }, developers), {
    frontendDeveloperIds: [],
    includeBackend: true,
    backendOwnerId: 'shu-jie',
  })
})

test('rejects an allocation profile with no selected developers', () => {
  assert.throws(() => normalizeAllocationProfile({
    frontendDeveloperIds: [],
    includeBackend: false,
    backendOwnerId: '',
  }, developers), { code: 'ALLOCATION_PROFILE_INVALID' })
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

test('maps one normalized allocation profile to every selected feature key', () => {
  const profiles = profilesForFeatureGroups([
    { featureKey: 'prd:account' },
    { featureKey: 'folder:invite' },
    { featureKey: 'folder:invite' },
  ], {
    'folder:invite': {
      frontendDeveloperIds: ['zeng-yuqiu'],
      includeBackend: true,
      backendOwnerId: 'shu-jie',
    },
  }, developers)

  assert.deepEqual(Object.keys(profiles), ['prd:account', 'folder:invite'])
  assert.equal(profiles['prd:account'].includeBackend, false)
  assert.equal(profiles['folder:invite'].backendOwnerId, 'shu-jie')
})
