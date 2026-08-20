import { normalizeUploadedFilename, parseUploadedFile } from './documents.js'
import { extractZipMarkdownEntries, MAX_IMPORTED_DOCUMENTS } from './zip-markdown.js'

function failedFile(file, error) {
  return {
    sourceLabel: normalizeUploadedFilename(file?.originalname) || '未命名文件',
    error: error.message || '文档读取失败',
    code: error.code || 'DOCUMENT_PARSE_FAILED',
  }
}

async function parseOne(file) {
  try {
    return { parsed: { ...await parseUploadedFile(file), sourceType: 'file' } }
  } catch (error) {
    return { failed: failedFile(file, error) }
  }
}

export async function parsePrdUpload({ files = [], archive = null }) {
  if (files.length > MAX_IMPORTED_DOCUMENTS) {
    throw Object.assign(new Error(`一次最多导入 ${MAX_IMPORTED_DOCUMENTS} 份 PRD 文档`), { code: 'PRD_DOCUMENT_LIMIT' })
  }

  let archiveFiles = []
  const failed = []
  if (archive) {
    try {
      archiveFiles = await extractZipMarkdownEntries(archive, { maxEntries: MAX_IMPORTED_DOCUMENTS - files.length })
    } catch (error) {
      failed.push(failedFile(archive, error))
    }
  }

  const outcomes = await Promise.all([...files, ...archiveFiles].map(parseOne))
  return {
    parsed: outcomes.flatMap((outcome) => outcome.parsed ? [outcome.parsed] : []),
    failed: [...failed, ...outcomes.flatMap((outcome) => outcome.failed ? [outcome.failed] : [])],
  }
}
