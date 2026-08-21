import assert from 'node:assert/strict'
import test from 'node:test'
import { initialLibrarySelection, isImportResultScreen, shouldShowFeatureAllocation } from '../src/import-modal-state.js'

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

test('shows feature allocation after a local import succeeds', () => {
  assert.equal(shouldShowFeatureAllocation('file', { imported: [{ id: 'prd-1' }] }, { resultScreen: true }), true)
  assert.equal(shouldShowFeatureAllocation('library', null), true)
  assert.equal(shouldShowFeatureAllocation('file', { imported: [] }), false)
})

test('hides feature allocation while a selected library batch is showing results', () => {
  assert.equal(shouldShowFeatureAllocation('library', null, { resultScreen: true }), false)
})

test('preselects only unique existing PRDs when reanalysis opens the library view', () => {
  const selected = initialLibrarySelection([
    { id: 'prd-a' },
    { id: 'prd-b' },
  ], ['prd-b', 'missing', 'prd-b'])

  assert.deepEqual(selected, ['prd-b'])
})
