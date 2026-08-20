import assert from 'node:assert/strict'
import test from 'node:test'
import { fingerprintPrdContent, insertParsedPrds, markPrdAllocationFailed, markPrdAllocationStarted, recoverInterruptedPrdAllocations, sortPrdsNewestFirst, toPublicPrd } from '../server/prds.js'

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

test('stores a shared feature identity for documents from the same folder', () => {
  const state = { prds: [] }
  let index = 0

  insertParsedPrds(state, [
    { title: '开发阅读版', content: '开发范围', sourceLabel: '内测邀请码注册-v2/开发.md', sourceType: 'file' },
    { title: '负责人验收', content: '验收范围', sourceLabel: '内测邀请码注册-v2/验收.md', sourceType: 'file' },
  ], { createId: () => `prd-${++index}`, now: () => '2026-08-20T00:00:00.000Z' })

  assert.deepEqual(state.prds.map((prd) => [prd.featureKey, prd.featureName]), [
    ['folder:内测邀请码注册-v2', '内测邀请码注册'],
    ['folder:内测邀请码注册-v2', '内测邀请码注册'],
  ])
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

test('recovers allocations interrupted by a service restart', () => {
  const state = {
    prds: [
      { id: 'prd-1', analysisStatus: 'analyzing', analysisError: '', taskCount: 0 },
      { id: 'prd-2', analysisStatus: 'completed', analysisError: '', taskCount: 3 },
    ],
  }

  const recovered = recoverInterruptedPrdAllocations(state, '2026-08-20T04:00:00.000Z')

  assert.equal(recovered, 1)
  assert.deepEqual(state.prds[0], {
    id: 'prd-1',
    analysisStatus: 'failed',
    analysisError: '分配服务已重启，上一轮分配已中断，请重新分配',
    analysisFinishedAt: '2026-08-20T04:00:00.000Z',
    updatedAt: '2026-08-20T04:00:00.000Z',
    taskCount: 0,
  })
  assert.equal(state.prds[1].analysisStatus, 'completed')
})
