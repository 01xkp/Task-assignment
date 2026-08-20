import assert from 'node:assert/strict'
import test from 'node:test'
import yazl from 'yazl'
import { extractZipMarkdownEntries } from '../server/zip-markdown.js'

function zipBuffer(entries) {
  const zip = new yazl.ZipFile()
  const chunks = []
  zip.outputStream.on('data', (chunk) => chunks.push(chunk))
  const finished = new Promise((resolve, reject) => {
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)))
    zip.outputStream.on('error', reject)
  })
  for (const [name, content] of entries) zip.addBuffer(Buffer.from(content, 'utf8'), name)
  zip.end()
  return finished
}

test('extracts nested Markdown entries and skips non-Markdown files', async () => {
  const entries = await extractZipMarkdownEntries({
    originalname: '需求包.zip',
    buffer: await zipBuffer([
      ['一期/登录.md', '# 登录\n支持手机号和验证码登录。'],
      ['一期/notes.txt', 'ignore'],
      ['二期/订单.MD', '# 订单\n支持订单取消和退款申请。'],
    ]),
  })

  assert.deepEqual(entries.map((entry) => entry.originalname), ['需求包.zip!/一期/登录.md', '需求包.zip!/二期/订单.MD'])
})

test('rejects ZIPs without Markdown and ZIPs exceeding the entry count', async () => {
  const empty = await zipBuffer([['readme.txt', 'ignore']])
  const many = await zipBuffer([['a.md', 'A'], ['b.md', 'B']])

  await assert.rejects(
    () => extractZipMarkdownEntries({ originalname: 'empty.zip', buffer: empty }),
    { code: 'ZIP_NO_MARKDOWN' },
  )
  await assert.rejects(
    () => extractZipMarkdownEntries({ originalname: 'many.zip', buffer: many }, { maxEntries: 1 }),
    { code: 'ZIP_DOCUMENT_LIMIT' },
  )
})

test('rejects corrupt data and uncompressed content beyond its limit', async () => {
  const large = await zipBuffer([['large.md', 'a'.repeat(1024)]])

  await assert.rejects(
    () => extractZipMarkdownEntries({ originalname: 'broken.zip', buffer: Buffer.from('not a zip') }),
    { code: 'ZIP_INVALID' },
  )
  await assert.rejects(
    () => extractZipMarkdownEntries({ originalname: 'large.zip', buffer: large }, { maxBytes: 512 }),
    { code: 'ZIP_SIZE_LIMIT' },
  )
})
