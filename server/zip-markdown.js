import { once } from 'node:events'
import yauzl from 'yauzl'

export const MAX_IMPORTED_DOCUMENTS = 100
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_ZIP_MARKDOWN_BYTES = 50 * 1024 * 1024

function zipError(message, code) {
  return Object.assign(new Error(message), { code })
}

function safeEntryPath(value) {
  const entryPath = String(value || '').replaceAll('\\', '/')
  const parts = entryPath.split('/')
  if (!entryPath || entryPath.includes('\0') || entryPath.startsWith('/') || parts.some((part) => part === '.' || part === '..')) {
    throw zipError('ZIP 包含不安全的文件路径', 'ZIP_UNSAFE_PATH')
  }
  return entryPath
}

async function readEntryBuffer(stream, maxBytes) {
  const chunks = []
  let total = 0
  stream.on('data', (chunk) => {
    total += chunk.length
    if (total > maxBytes) stream.destroy(zipError('ZIP 解压内容超过允许大小', 'ZIP_SIZE_LIMIT'))
    else chunks.push(chunk)
  })
  await once(stream, 'end')
  return Buffer.concat(chunks)
}

function normalizedZipError(error) {
  if (String(error?.code || '').startsWith('ZIP_')) return error
  return zipError('ZIP 文件无法读取或已损坏', 'ZIP_INVALID')
}

export async function extractZipMarkdownEntries(archive, {
  maxEntries = MAX_IMPORTED_DOCUMENTS,
  maxBytes = MAX_ZIP_MARKDOWN_BYTES,
} = {}) {
  try {
    const zip = await yauzl.fromBufferPromise(archive.buffer, { lazyEntries: true, validateEntrySizes: true })
    const entries = []
    let totalBytes = 0

    for await (const entry of zip.eachEntry()) {
      const entryPath = safeEntryPath(entry.fileName)
      if (entryPath.endsWith('/') || !/\.md$/i.test(entryPath)) continue
      if (entry.isEncrypted() || !entry.canDecodeFileData()) {
        throw zipError('ZIP 不支持加密或未知压缩方式的 Markdown 文件', 'ZIP_UNSUPPORTED_ENTRY')
      }
      if (entry.uncompressedSize > MAX_DOCUMENT_BYTES || totalBytes + entry.uncompressedSize > maxBytes) {
        throw zipError('ZIP 解压后的 Markdown 内容超过允许大小', 'ZIP_SIZE_LIMIT')
      }
      if (entries.length >= maxEntries) {
        throw zipError(`一次最多导入 ${maxEntries} 份 Markdown 文档`, 'ZIP_DOCUMENT_LIMIT')
      }

      const buffer = await readEntryBuffer(await zip.openReadStreamPromise(entry), MAX_DOCUMENT_BYTES)
      totalBytes += buffer.length
      entries.push({
        originalname: `${archive.originalname}!/${entryPath}`,
        buffer,
        mimetype: 'text/markdown',
      })
    }

    if (!entries.length) throw zipError('ZIP 中没有可导入的 Markdown 文档', 'ZIP_NO_MARKDOWN')
    return entries
  } catch (error) {
    throw normalizedZipError(error)
  }
}
