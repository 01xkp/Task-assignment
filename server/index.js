import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import multer from 'multer'
import { config, publicModelConfig } from './config.js'
import { developers, newId, publicState, readState, updateState } from './storage.js'
import { fetchOnlineDocument, parseUploadedFile } from './documents.js'
import { retrieveKnowledge } from './knowledge.js'
import { analyzePrd, suggestReassignment } from './model.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  defParamCharset: 'utf8',
})
const activePrdAnalyses = new Set()

app.use(express.json({ limit: '2mb' }))

function receivePrdFile(request, response, next) {
  upload.single('file')(request, response, (error) => {
    if (!error) return next()
    const uploadError = new Error(error.code === 'LIMIT_FILE_SIZE'
      ? 'PRD 文档不能超过 10MB'
      : '上传请求格式无效，请重新选择文档')
    uploadError.code = error.code || 'UPLOAD_FAILED'
    handleError(uploadError, response)
  })
}

function workloads(state, excludedTaskId = '') {
  return Object.fromEntries(developers.map((developer) => [
    developer.name,
    state.tasks
      .filter((task) => task.id !== excludedTaskId && task.assignee === developer.name && !['已完成', '已取消'].includes(task.status))
      .reduce((total, task) => total + Number(task.estimateHours || 0), 0),
  ]))
}

function taskDueDate(index) {
  const date = new Date()
  date.setDate(date.getDate() + 2 + Math.floor(index / 2))
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function handleError(error, response) {
  const status = {
    ANALYSIS_IN_PROGRESS: 409,
    KNOWLEDGE_NOT_FOUND: 404,
    MODEL_NOT_CONFIGURED: 503,
    MODEL_TIMEOUT: 504,
    MODEL_RATE_LIMITED: 429,
    MODEL_GATEWAY_ERROR: 502,
  }[error.code] || 400
  response.status(status).json({ error: error.message || '请求处理失败', code: error.code || 'REQUEST_FAILED' })
}

function writeSse(response, event, payload) {
  if (response.destroyed || response.writableEnded) return
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
}

async function runPrdAnalysis(prdId, options = {}, onProgress = () => {}) {
  if (activePrdAnalyses.has(prdId)) {
    const error = new Error('该 PRD 正在分析中，请等待当前分析完成')
    error.code = 'ANALYSIS_IN_PROGRESS'
    throw error
  }

  activePrdAnalyses.add(prdId)
  const startedAt = Date.now()
  try {
    const state = await readState()
    const prd = state.prds.find((item) => item.id === prdId)
    if (!prd) {
      const error = new Error('PRD 不存在')
      error.code = 'PRD_NOT_FOUND'
      throw error
    }

    const configuredModel = config.model
    const configuredReviewModel = config.model
    const reasoningEffort = config.reasoningEffort
    onProgress({ stage: 'context', percent: 6, message: '正在读取工程模块、团队负载和历史调整知识', model: configuredModel, reasoningEffort })
    const relatedKnowledge = retrieveKnowledge(state.knowledge, `${prd.title} ${prd.content}`, 12)
    onProgress({ stage: 'context-ready', percent: 10, message: `分析上下文已准备，共匹配 ${relatedKnowledge.length} 条历史知识`, model: configuredModel })

    const result = await analyzePrd({
      prd,
      knowledge: relatedKnowledge,
      workloads: workloads(state),
      useReview: options.review !== false,
      reasoningEffort,
      onProgress,
    })
    onProgress({ stage: 'saving', percent: 96, message: '正在保存任务分配和分析记录', model: configuredModel })

    const createdAt = new Date().toISOString()
    const tasks = result.tasks.map((task, index) => ({
      id: newId('task'),
      prdId: prd.id,
      ...task,
      assignee: task.suggestedAssignee,
      status: '待开始',
      dueDate: taskDueDate(index),
      createdAt,
      updatedAt: createdAt,
    }))
    const durationMs = Date.now() - startedAt
    const draftTrace = result.modelTrace?.draft || {}
    const reviewTrace = result.modelTrace?.review || {}
    const actualModel = draftTrace.responseModel || configuredModel
    const actualReviewModel = reviewTrace.responseModel || configuredReviewModel
    await updateState((draft) => {
      draft.tasks = draft.tasks.filter((task) => task.prdId !== prd.id || task.status !== '待开始')
      draft.tasks.unshift(...tasks)
      const storedPrd = draft.prds.find((item) => item.id === prd.id)
      if (!storedPrd) throw new Error('PRD 已在分析期间被删除')
      storedPrd.analyzedAt = createdAt
      storedPrd.analysisStatus = 'completed'
      storedPrd.taskCount = tasks.length
      storedPrd.summary = result.summary
      storedPrd.analysisRequestedModel = configuredModel
      storedPrd.analysisModel = actualModel
      storedPrd.analysisModelVerified = Boolean(draftTrace.responseModel)
      storedPrd.reviewRequestedModel = configuredReviewModel
      storedPrd.reviewModel = actualReviewModel
      storedPrd.reviewModelVerified = Boolean(reviewTrace.responseModel)
      storedPrd.analysisReasoningEffort = reasoningEffort
      storedPrd.analysisDurationMs = durationMs
      storedPrd.analysisTrace = result.modelTrace
      draft.activity.unshift({
        id: newId('act'),
        type: 'analysis',
        title: `已分析 ${prd.title}`,
        detail: `请求 ${configuredModel}，网关${draftTrace.responseModel ? `返回 ${draftTrace.responseModel}` : '未返回模型标识'}；${reasoningEffort} 推理生成 ${tasks.length} 个任务${result.reviewed ? `，复核返回 ${actualReviewModel}` : ''}；拆分 ${Math.round((draftTrace.durationMs || 0) / 1000)} 秒，复核 ${Math.round((reviewTrace.durationMs || 0) / 1000)} 秒，总计 ${Math.max(1, Math.round(durationMs / 1000))} 秒`,
        createdAt,
      })
    })
    onProgress({ stage: 'complete', percent: 100, message: `分析完成，网关实际返回 ${actualModel}`, model: actualModel, reasoningEffort })
    return {
      tasks,
      summary: result.summary,
      reviewed: result.reviewed,
      reviewWarning: result.reviewWarning,
      model: actualModel,
      requestedModel: configuredModel,
      reasoningEffort,
      modelTrace: result.modelTrace,
      durationMs,
    }
  } finally {
    activePrdAnalyses.delete(prdId)
  }
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, model: publicModelConfig() })
})

app.get('/api/state', async (_request, response) => {
  response.json({ ...publicState(await readState()), model: publicModelConfig() })
})

app.get('/api/prds/:id', async (request, response) => {
  const state = await readState()
  const prd = state.prds.find((item) => item.id === request.params.id)
  if (!prd) return response.status(404).json({ error: 'PRD 不存在' })
  response.json(prd)
})

app.post('/api/prds/upload', receivePrdFile, async (request, response) => {
  try {
    if (!request.file) throw new Error('请选择要上传的 PRD 文档')
    const parsed = await parseUploadedFile(request.file)
    const prd = { id: newId('prd'), ...parsed, sourceType: 'file', createdAt: new Date().toISOString(), analysisStatus: 'ready', taskCount: 0 }
    await updateState((state) => { state.prds.unshift(prd) })
    response.status(201).json({ ...prd, content: undefined })
  } catch (error) {
    handleError(error, response)
  }
})

app.post('/api/prds/url', async (request, response) => {
  try {
    const parsed = await fetchOnlineDocument(request.body.url)
    const prd = { id: newId('prd'), ...parsed, sourceType: 'url', createdAt: new Date().toISOString(), analysisStatus: 'ready', taskCount: 0 }
    await updateState((state) => { state.prds.unshift(prd) })
    response.status(201).json({ ...prd, content: undefined })
  } catch (error) {
    handleError(error, response)
  }
})

app.post('/api/prds/text', async (request, response) => {
  try {
    const content = String(request.body.content || '').trim()
    if (content.length < 20) throw new Error('PRD 正文至少需要 20 个字符')
    const prd = { id: newId('prd'), title: String(request.body.title || '粘贴的 PRD').slice(0, 80), content, sourceType: 'text', sourceLabel: '手动粘贴', createdAt: new Date().toISOString(), analysisStatus: 'ready', taskCount: 0 }
    await updateState((state) => { state.prds.unshift(prd) })
    response.status(201).json({ ...prd, content: undefined })
  } catch (error) {
    handleError(error, response)
  }
})

app.delete('/api/prds/:id', async (request, response) => {
  try {
    let deleted
    await updateState((state) => {
      const index = state.prds.findIndex((item) => item.id === request.params.id)
      if (index === -1) throw new Error('PRD 不存在')
      const [prd] = state.prds.splice(index, 1)
      const relatedTasks = state.tasks.filter((task) => task.prdId === prd.id)
      state.tasks = state.tasks.filter((task) => task.prdId !== prd.id)
      const createdAt = new Date().toISOString()
      state.activity.unshift({
        id: newId('act'),
        type: 'deletion',
        title: `已删除 ${prd.title}`,
        detail: `同时移除 ${relatedTasks.length} 个关联任务，历史调整知识保留`,
        createdAt,
      })
      deleted = { id: prd.id, title: prd.title, deletedTaskCount: relatedTasks.length }
    })
    response.json(deleted)
  } catch (error) {
    handleError(error, response)
  }
})

app.post('/api/prds/:id/analyze', async (request, response) => {
  const wantsStream = request.headers.accept?.includes('text/event-stream')
  if (!wantsStream) {
    try {
      return response.json(await runPrdAnalysis(request.params.id, request.body))
    } catch (error) {
      return handleError(error, response)
    }
  }

  response.status(200)
  response.set({
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream; charset=utf-8',
    'X-Accel-Buffering': 'no',
  })
  response.flushHeaders()
  response.socket?.setTimeout(0)

  const startedAt = Date.now()
  let lastProgress = { stage: 'connecting', percent: 2, message: '正在连接模型服务', model: config.model, reasoningEffort: config.reasoningEffort }
  const reportProgress = (progress) => {
    lastProgress = { ...lastProgress, ...progress }
    writeSse(response, 'progress', { ...lastProgress, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) })
  }
  reportProgress(lastProgress)
  const heartbeat = setInterval(() => {
    reportProgress({ heartbeat: true })
  }, 10000)

  try {
    const result = await runPrdAnalysis(request.params.id, request.body, reportProgress)
    writeSse(response, 'result', result)
  } catch (error) {
    writeSse(response, 'error', { error: error.message || '请求处理失败', code: error.code || 'REQUEST_FAILED' })
  } finally {
    clearInterval(heartbeat)
    response.end()
  }
})

app.delete('/api/knowledge/:id', async (request, response) => {
  try {
    let deleted
    await updateState((state) => {
      const index = state.knowledge.findIndex((item) => item.id === request.params.id)
      if (index === -1) {
        const error = new Error('知识记录不存在或已被删除')
        error.code = 'KNOWLEDGE_NOT_FOUND'
        throw error
      }
      const [entry] = state.knowledge.splice(index, 1)
      deleted = {
        id: entry.id,
        taskTitle: entry.taskTitle,
        type: entry.type,
        module: entry.module,
      }
    })
    response.json(deleted)
  } catch (error) {
    handleError(error, response)
  }
})

app.post('/api/tasks/:id/reject', async (request, response) => {
  try {
    const reason = String(request.body.reason || '').trim()
    if (reason.length < 4) throw new Error('请说明拒绝原因，至少 4 个字符')
    const createdAt = new Date().toISOString()
    let updatedTask
    await updateState((state) => {
      const task = state.tasks.find((item) => item.id === request.params.id)
      if (!task) throw new Error('任务不存在')
      const fromAssignee = task.assignee
      task.status = '待重分配'
      task.updatedAt = createdAt
      task.lastAdjustmentReason = reason
      state.knowledge.unshift({ id: newId('know'), type: 'rejection', taskId: task.id, taskTitle: task.title, fromAssignee, toAssignee: '', reason, module: task.module, createdAt, source: 'human' })
      state.activity.unshift({ id: newId('act'), type: 'rejection', title: `${fromAssignee} 拒绝了任务`, detail: `${task.title} · ${reason}`, createdAt })
      updatedTask = { ...task }
    })
    response.json(updatedTask)
  } catch (error) {
    handleError(error, response)
  }
})

app.post('/api/tasks/:id/reassign', async (request, response) => {
  try {
    const reason = String(request.body.reason || '').trim()
    const note = String(request.body.note || '').trim()
    const assignee = String(request.body.assignee || '')
    if (!developers.some((item) => item.name === assignee)) throw new Error('请选择有效的开发者')
    if (reason.length < 4) throw new Error('请说明重分配原因，至少 4 个字符')
    if (note.length < 2) throw new Error('请填写重新分配备注，至少 2 个字符')
    const createdAt = new Date().toISOString()
    let updatedTask
    await updateState((state) => {
      const task = state.tasks.find((item) => item.id === request.params.id)
      if (!task) throw new Error('任务不存在')
      const fromAssignee = task.assignee
      if (fromAssignee === assignee) throw new Error('请选择不同的开发者')
      task.assignee = assignee
      task.status = '待开始'
      task.updatedAt = createdAt
      task.lastAdjustmentReason = reason
      task.lastReassignmentNote = note
      state.knowledge.unshift({ id: newId('know'), type: 'reassignment', taskId: task.id, taskTitle: task.title, fromAssignee, toAssignee: assignee, reason, note, module: task.module, createdAt, source: request.body.source === 'ai' ? 'ai' : 'human' })
      state.activity.unshift({ id: newId('act'), type: 'reassignment', title: `任务已调整给${assignee}`, detail: `${task.title} · ${reason} · 备注：${note}`, createdAt })
      updatedTask = { ...task }
    })
    response.json(updatedTask)
  } catch (error) {
    handleError(error, response)
  }
})

app.post('/api/tasks/:id/suggest-reassignment', async (request, response) => {
  try {
    const state = await readState()
    const task = state.tasks.find((item) => item.id === request.params.id)
    if (!task) return response.status(404).json({ error: '任务不存在' })
    const knowledge = retrieveKnowledge(state.knowledge, `${task.title} ${task.description} ${task.module}`, 8)
    response.json(await suggestReassignment({ task, knowledge, workloads: workloads(state, task.id) }))
  } catch (error) {
    handleError(error, response)
  }
})

app.patch('/api/tasks/:id', async (request, response) => {
  try {
    const allowedStatuses = ['待开始', '进行中', '评审中', '已完成', '待重分配', '已取消']
    if (!allowedStatuses.includes(request.body.status)) throw new Error('任务状态无效')
    let updatedTask
    await updateState((state) => {
      const task = state.tasks.find((item) => item.id === request.params.id)
      if (!task) throw new Error('任务不存在')
      task.status = request.body.status
      task.updatedAt = new Date().toISOString()
      updatedTask = { ...task }
    })
    response.json(updatedTask)
  } catch (error) {
    handleError(error, response)
  }
})

app.use('/api', (request, response) => {
  response.status(404).json({
    error: `API 路径不存在：${request.method} ${request.originalUrl}`,
    code: 'API_NOT_FOUND',
  })
})

const distPath = path.resolve(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*all', (_request, response) => response.sendFile(path.join(distPath, 'index.html')))

app.listen(config.port, config.host, () => {
  console.log(`DevFlow API listening on http://${config.host}:${config.port}`)
})
