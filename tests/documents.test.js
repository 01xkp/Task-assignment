import assert from 'node:assert/strict'
import test from 'node:test'
import { parseUploadedFile } from '../server/documents.js'
import { publicState } from '../server/storage.js'

const filename = '多端登录需求.md'
const latin1Filename = Buffer.from(filename, 'utf8').toString('latin1')

test('preserves a UTF-8 Chinese filename decoded as latin1', async () => {
  const parsed = await parseUploadedFile({
    buffer: Buffer.from('多端登录需求\n支持同账号多设备数据同步。', 'utf8'),
    originalname: latin1Filename,
    mimetype: 'text/markdown',
  })

  assert.equal(parsed.sourceLabel, filename)
})

test('preserves a Chinese filename already decoded as UTF-8', async () => {
  const parsed = await parseUploadedFile({
    buffer: Buffer.from('公告\n支持多端同步通知，并展示未读状态与已读记录。', 'utf8'),
    originalname: '公告.md',
    mimetype: 'text/markdown',
  })

  assert.equal(parsed.sourceLabel, '公告.md')
})

test('restores a legacy Chinese filename in the public PRD list', () => {
  const state = publicState({
    prds: [{
      id: 'prd-1',
      title: '多端登录需求',
      content: '支持同账号多设备数据同步。',
      sourceType: 'file',
      sourceLabel: latin1Filename,
    }],
    tasks: [],
    knowledge: [],
    activity: [],
  })

  assert.equal(state.prds[0].sourceLabel, filename)
})

test('returns public PRDs ordered by most recent update', () => {
  const state = publicState({
    prds: [
      { id: 'old', title: '旧', content: '旧内容', createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z' },
      { id: 'new', title: '新', content: '新内容', createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-19T00:00:00.000Z' },
    ],
    tasks: [],
    knowledge: [],
    activity: [],
  })

  assert.deepEqual(state.prds.map((prd) => prd.id), ['new', 'old'])
})
