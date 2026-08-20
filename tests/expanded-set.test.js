import assert from 'node:assert/strict'
import test from 'node:test'
import { toggleSetValue } from '../src/expanded-set.js'

test('toggles an item without mutating the current expanded set', () => {
  const current = new Set(['prd-1'])

  const expanded = toggleSetValue(current, 'prd-1:共享实现')
  const collapsed = toggleSetValue(expanded, 'prd-1:共享实现')

  assert.deepEqual([...current], ['prd-1'])
  assert.deepEqual([...expanded], ['prd-1', 'prd-1:共享实现'])
  assert.deepEqual([...collapsed], ['prd-1'])
})
