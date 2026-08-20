import assert from 'node:assert/strict'
import test from 'node:test'
import { allocationActionLabel, allocationStatusPresentation } from '../src/prd-allocation-status.js'

test('maps persisted allocation statuses to Chinese UI labels', () => {
  assert.equal(allocationStatusPresentation('ready').label, '待分配')
  assert.equal(allocationStatusPresentation('analyzing').label, '分配中')
  assert.equal(allocationStatusPresentation('completed').label, '重新分配')
  assert.equal(allocationStatusPresentation('failed').label, '分配失败')
})

test('uses allocation actions for new, completed, and failed PRDs', () => {
  assert.equal(allocationActionLabel('ready'), '开始分配')
  assert.equal(allocationActionLabel('completed'), '重新分配')
  assert.equal(allocationActionLabel('failed'), '重新分配')
  assert.equal(allocationActionLabel('analyzing'), '分配中')
})
