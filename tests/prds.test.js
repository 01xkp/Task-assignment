import assert from 'node:assert/strict'
import test from 'node:test'
import { fingerprintPrdContent, insertParsedPrds, markPrdAllocationFailed, markPrdAllocationStarted, sortPrdsNewestFirst, toPublicPrd } from '../server/prds.js'

test('hashes formatting-only content differences identically', () => {
  assert.equal(
    fingerprintPrdContent('需求\r\n\r\n\r\n  支持\u00a0多端登录  '),
    fingerprintPrdContent('需求\n\n支持 多端登录'),
  )
})

test('keeps only one same-content PRD across a batch and existing state', () => {
  const state = { prds: [{ id: 'prd-old', title: '已有', contentFingerprint: fingerprintPrdContent('已有需求') }] }
  const result = insertParsedPrds(state, [
    { title: 'A', content: '新需求', sourceLabel: 'a.md', sourceType: 'file' },
    { title: 'B', content: '新需求', sourceLabel: 'b.md', sourceType: 'file' },
    { title: 'C', content: '已有需求', sourceLabel: 'c.md', sourceType: 'file' },
  ], { createId: () => `prd-${state.prds.length}`, now: () => '2026-08-19T00:00:00.000Z' })

  assert.equal(result.imported.length, 1)
  assert.equal(result.duplicates.length, 2)
  assert.equal(state.prds.length, 2)
})

test('allows updated content with the same filename and orders the update first', () => {
  const state = { prds: [] }
  insertParsedPrds(state, [{ title: '登录', content: '版本一', sourceLabel: '登录.md', sourceType: 'file' }], { createId: () => 'prd-1', now: () => '2026-08-18T00:00:00.000Z' })
  insertParsedPrds(state, [{ title: '登录', content: '版本二', sourceLabel: '登录.md', sourceType: 'file' }], { createId: () => 'prd-2', now: () => '2026-08-19T00:00:00.000Z' })

  assert.deepEqual(sortPrdsNewestFirst(state.prds).map((prd) => prd.id), ['prd-2', 'prd-1'])
})

test('removes PRD content from the upload response item', () => {
  assert.deepEqual(
    toPublicPrd({ id: 'prd-1', title: '登录', content: '不应返回', contentFingerprint: 'hash' }),
    { id: 'prd-1', title: '登录', contentFingerprint: 'hash' },
  )
})

test('records allocation start and clears an earlier failure', () => {
  const prd = { id: 'prd-1', analysisStatus: 'failed', analysisError: '旧错误', taskCount: 0 }

  markPrdAllocationStarted(prd, '2026-08-20T01:00:00.000Z')

  assert.deepEqual(prd, {
    id: 'prd-1',
    analysisStatus: 'analyzing',
    taskCount: 0,
    analysisStartedAt: '2026-08-20T01:00:00.000Z',
    analysisFinishedAt: '',
    analysisError: '',
    updatedAt: '2026-08-20T01:00:00.000Z',
  })
})

test('records a bounded allocation failure', () => {
  const prd = { id: 'prd-1', analysisStatus: 'analyzing' }

  markPrdAllocationFailed(prd, '模型请求超时 '.repeat(80), '2026-08-20T01:06:00.000Z')

  assert.equal(prd.analysisStatus, 'failed')
  assert.equal(prd.analysisFinishedAt, '2026-08-20T01:06:00.000Z')
  assert.equal(prd.analysisError.length, 240)
})
