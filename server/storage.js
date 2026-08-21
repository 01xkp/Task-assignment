import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from './config.js'
import { normalizeUploadedFilename } from './documents.js'
import { sortPrdsNewestFirst, toPublicPrd } from './prds.js'
import { projectContext } from './project-context.js'

export const developers = [
  {
    id: 'xiang-kunpeng',
    name: '向坤朋',
    initials: '向',
    color: '#0f8a6a',
    discipline: 'frontend',
    role: 'Flutter · Windows / Linux',
    primaryPlatforms: ['Windows', 'Linux'],
    skills: ['Flutter 桌面端', 'Windows', 'Linux', '窗口与托盘生命周期', '宽屏布局', '桌面文件与权限'],
    weeklyCapacity: 40,
  },
  {
    id: 'zeng-yuqiu',
    name: '曾雨秋',
    initials: '曾',
    color: '#347f71',
    discipline: 'frontend',
    role: 'Flutter · Android',
    primaryPlatforms: ['Android'],
    skills: ['Flutter Android', 'Android 生命周期', '权限与媒体', 'Gradle', '移动端稳定性', '自动化测试'],
    weeklyCapacity: 40,
  },
  {
    id: 'zhang-xu',
    name: '张徐',
    initials: '张',
    color: '#5c6f69',
    discipline: 'frontend',
    role: 'Flutter · iOS / macOS',
    primaryPlatforms: ['iOS', 'macOS'],
    skills: ['Flutter iOS', 'Flutter macOS', 'CocoaPods', 'Xcode 与签名', 'Apple 生命周期', '桌面适配'],
    weeklyCapacity: 40,
  },
  {
    id: 'shu-jie',
    name: '舒杰',
    initials: '舒',
    color: '#966b16',
    discipline: 'backend',
    role: 'Go 后端',
    primaryPlatforms: ['服务端'],
    skills: ['Go', 'HTTP API', 'Handler / Service / Repository', '数据库迁移', '事务与并发控制'],
    weeklyCapacity: 40,
  },
  {
    id: 'chen-yuanzhi',
    name: '陈远志',
    initials: '陈',
    color: '#7b4b9d',
    discipline: 'backend',
    role: 'Go 后端',
    primaryPlatforms: ['服务端'],
    skills: ['Go', '领域服务', 'Repository', '数据库设计', '接口测试'],
    weeklyCapacity: 40,
  },
]

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}/*  */

function seedState() {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    prds: [],
    tasks: [],
    knowledge: [],
    activity: [],
  }
}

let writeQueue = Promise.resolve()

async function ensureState() {
  await mkdir(path.dirname(config.dataFile), { recursive: true })
  try {
    await readFile(config.dataFile, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await writeFile(config.dataFile, JSON.stringify(seedState(), null, 2), 'utf8')
  }
}

export async function readState() {
  await ensureState()
  return JSON.parse(await readFile(config.dataFile, 'utf8'))
}

export async function updateState(mutator) {
  const operation = writeQueue.catch(() => undefined).then(async () => {
    const state = await readState()
    const result = await mutator(state)
    state.updatedAt = new Date().toISOString()
    const tempFile = `${config.dataFile}.tmp`
    await writeFile(tempFile, JSON.stringify(state, null, 2), 'utf8')
    await rename(tempFile, config.dataFile)
    return result
  })
  writeQueue = operation.then(() => undefined, () => undefined)
  return operation
}

export function publicState(state) {
  return {
    ...state,
    prds: sortPrdsNewestFirst(state.prds).map((prd) => ({
      ...toPublicPrd(prd),
      sourceLabel: prd.sourceType === 'file' ? normalizeUploadedFilename(prd.sourceLabel) : prd.sourceLabel,
      excerpt: prd.content.slice(0, 180),
      contentLength: prd.content.length,
    })),
    developers,
    project: {
      name: projectContext.name,
      repository: projectContext.repository,
      sdk: projectContext.sdk,
      platforms: projectContext.platforms,
      moduleCount: projectContext.modules.length,
      modules: projectContext.modules.map(({ id, name, path, scale }) => ({ id, name, path, scale })),
    },
  }
}
