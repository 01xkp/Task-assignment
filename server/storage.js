import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from './config.js'
import { projectContext } from './project-context.js'

export const developers = [
  {
    id: 'xiang-kunpeng',
    name: '向坤朋',
    initials: '向',
    color: '#0f8a6a',
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
    role: 'Flutter · iOS / macOS',
    primaryPlatforms: ['iOS', 'macOS'],
    skills: ['Flutter iOS', 'Flutter macOS', 'CocoaPods', 'Xcode 与签名', 'Apple 生命周期', '桌面适配'],
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
    prds: state.prds.map(({ content, ...prd }) => ({
      ...prd,
      excerpt: content.slice(0, 180),
      contentLength: content.length,
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
