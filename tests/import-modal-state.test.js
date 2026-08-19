import assert from 'node:assert/strict'
import test from 'node:test'
import { isImportResultScreen } from '../src/import-modal-state.js'

test('shows the result screen after analyzing selected library PRDs', () => {
  assert.equal(isImportResultScreen(null, { succeeded: [], failed: [] }), true)
})

test('shows the progress screen while selected library PRDs are analyzing', () => {
  assert.equal(isImportResultScreen(null, null, { mode: 'library', analyzing: true }), true)
  assert.equal(isImportResultScreen(null, null, { mode: 'file', analyzing: true }), false)
})

test('keeps the import screen open before importing or analyzing', () => {
  assert.equal(isImportResultScreen(null, null), false)
})
