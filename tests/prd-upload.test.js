import assert from 'node:assert/strict'
import test from 'node:test'
import yazl from 'yazl'
import { parsePrdUpload } from '../server/prd-upload.js'

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

const markdownFile = (originalname, content) => ({
  originalname,
  mimetype: 'text/markdown',
  buffer: Buffer.from(content, 'utf8'),
})

test('returns parsed plain and ZIP Markdown documents in one result', async () => {
  const result = await parsePrdUpload({
    files: [markdownFile('目录/普通.md', '# 普通需求\n支持普通文件导入，并记录完整的产品验收要求。')],
    archive: {
      originalname: '需求.zip',
      buffer: await zipBuffer([['nested/archive.md', '# 归档需求\n支持归档内文档导入，并覆盖完整的业务验收规则。']]),
    },
  })

  assert.deepEqual(result.parsed.map((item) => item.sourceLabel), ['目录/普通.md', '需求.zip!/nested/archive.md'])
  assert.deepEqual(result.failed, [])
})

test('keeps valid files when the ZIP cannot be read', async () => {
  const result = await parsePrdUpload({
    files: [markdownFile('普通.md', '# 普通需求\n支持普通文件导入，并记录完整的产品验收要求。')],
    archive: { originalname: '损坏.zip', buffer: Buffer.from('invalid') },
  })

  assert.equal(result.parsed.length, 1)
  assert.equal(result.failed[0].sourceLabel, '损坏.zip')
  assert.equal(result.failed[0].code, 'ZIP_INVALID')
})

test('rejects more than 100 regular documents before parsing', async () => {
  const files = Array.from({ length: 101 }, (_, index) => markdownFile(`${index}.md`, `# 需求 ${index}\n正文长度满足解析要求。`))

  await assert.rejects(
    () => parsePrdUpload({ files }),
    { code: 'PRD_DOCUMENT_LIMIT' },
  )
})
