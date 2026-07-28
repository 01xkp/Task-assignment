import path from 'node:path'
import { createRequire } from 'node:module'
import * as cheerio from 'cheerio'
import mammoth from 'mammoth'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

function cleanText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function inferTitle(text, fallback) {
  const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean)
  return (firstLine || fallback || '未命名 PRD').replace(/^#+\s*/, '').slice(0, 80)
}

async function extractBuffer(buffer, filename, contentType = '') {
  const extension = path.extname(filename || '').toLowerCase()
  if (extension === '.pdf' || contentType.includes('application/pdf')) {
    const parsed = await pdfParse(buffer)
    return cleanText(parsed.text)
  }
  if (extension === '.docx' || contentType.includes('wordprocessingml')) {
    const parsed = await mammoth.extractRawText({ buffer })
    return cleanText(parsed.value)
  }
  if (extension === '.doc') {
    throw new Error('暂不支持旧版 .doc，请另存为 .docx 后上传')
  }
  return cleanText(buffer.toString('utf8'))
}

export async function parseUploadedFile(file) {
  const content = await extractBuffer(file.buffer, file.originalname, file.mimetype)
  if (content.length < 20) throw new Error('文档内容过短或无法识别')
  return {
    title: inferTitle(content, path.parse(file.originalname).name),
    content,
    sourceLabel: file.originalname,
  }
}

export async function fetchOnlineDocument(urlValue) {
  let url
  try {
    url = new URL(urlValue)
  } catch {
    throw new Error('请输入有效的在线 PRD 地址')
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅支持 http 或 https 地址')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  let response
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'DevFlow-PRD-Importer/1.0' },
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) throw new Error(`在线文档读取失败（HTTP ${response.status}）`)

  const contentType = response.headers.get('content-type') || ''
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > 10 * 1024 * 1024) throw new Error('在线文档不能超过 10MB')

  let title = url.hostname
  let content
  if (contentType.includes('text/html')) {
    const $ = cheerio.load(buffer.toString('utf8'))
    title = cleanText($('title').first().text()) || title
    $('script, style, nav, footer, noscript').remove()
    content = cleanText($('main, article').first().text() || $('body').text())
  } else {
    content = await extractBuffer(buffer, path.basename(url.pathname), contentType)
  }
  if (content.length < 20) throw new Error('页面没有可读取的 PRD 正文')
  return { title: title.slice(0, 80), content, sourceLabel: url.toString() }
}

