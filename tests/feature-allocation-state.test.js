import assert from 'node:assert/strict'
import test from 'node:test'
import { developers } from '../server/storage.js'
import { isAllocationProfileComplete, selectedFeatureAllocationState } from '../src/feature-allocation-state.js'

test('uses one editable allocation profile for two PRDs in the same folder', () => {
  const result = selectedFeatureAllocationState([
    { id: 'dev', title: '开发', sourceType: 'file', sourceLabel: '邀请码/开发.md' },
    { id: 'accept', title: '验收', sourceType: 'file', sourceLabel: '邀请码/验收.md' },
  ], ['dev', 'accept'], developers)

  assert.equal(result.groups.length, 1)
  assert.deepEqual(result.profiles['folder:邀请码'], {
    frontendDeveloperIds: ['xiang-kunpeng', 'zeng-yuqiu', 'zhang-xu'],
    includeBackend: false,
    backendOwnerId: '',
  })
})

test('prefers a feature persisted candidate profile while ignoring legacy frontend owner data', () => {
  const result = selectedFeatureAllocationState([
    {
      id: 'invite', title: '邀请码', sourceType: 'file', sourceLabel: '邀请码/开发.md',
      allocationProfile: { frontendDeveloperIds: ['zeng-yuqiu'], frontendOwnerId: 'zeng-yuqiu', includeBackend: true, backendOwnerId: 'shu-jie' },
    },
  ], ['invite'], developers)

  assert.deepEqual(result.profiles['folder:邀请码'], {
    frontendDeveloperIds: ['zeng-yuqiu'],
    includeBackend: true,
    backendOwnerId: 'shu-jie',
  })
})

test('does not expose a persisted legacy owner in editable allocation state', () => {
  const result = selectedFeatureAllocationState([
    {
      id: 'invite', title: '邀请码', sourceType: 'file', sourceLabel: '邀请码/开发.md',
      allocationProfile: { frontendDeveloperIds: ['zeng-yuqiu'], frontendOwnerId: 'xiang-kunpeng', includeBackend: false, backendOwnerId: '' },
    },
  ], ['invite'], developers)

  assert.equal(Object.hasOwn(result.profiles['folder:邀请码'], 'frontendOwnerId'), false)
})

test('requires a backend owner when backend tasks are enabled', () => {
  assert.equal(isAllocationProfileComplete({
    frontendDeveloperIds: ['zeng-yuqiu'],
    includeBackend: true,
    backendOwnerId: '',
  }, developers), false)
})
