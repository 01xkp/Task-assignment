import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import multer from 'multer'
import { config, publicModelConfig } from './config.js'
import { developers, newId, publicState, readState, updateState } from './storage.js'
import { fetchOnlineDocument } from './documents.js'
import { retrieveKnowledge } from './knowledge.js'
import { analyzePrd, suggestReassignment } from './model.js'
import { featureGroupsForPrdIds, runSequentialFeatureAnalysis, uniquePrdIds } from './analysis-batch.js'
import { mergeAnalysisProgress } from './model-progress.js'
import { insertParsedPrds, markPrdAllocationFailed, markPrdAllocationStarted, recoverInterruptedPrdAllocations, toPublicPrd } from './prds.js'
import { parsePrdUpload } from './prd-upload.js'
import { reconcileFeatureTasks, removePrdFromFeatureTasks } from './tasks.js'
import { activeWorkloads, assertEligibleReassignment } from './task-allocation.js'
import { applyFeatureIdentity, groupPrdsByFeature, mergeFeaturePrds } from '../shared/feature-modules.js'
import { normalizeAllocationProfile, profilesForFeatureGroups } from '../shared/allocation-profile.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  preservePath: true,
  defParamCharset: 'utf8',
})
const activeFeatureAnalyses = new Set()

app.use(express.json({ limit: '2mb' }))

function receivePrdFiles(request, response, next) {
  upload.fields([{ name: 'files', maxCount: 100 }, { name: 'file', maxCount: 1 }, { name: 'archive', maxCount: 1 }])(request, response, (error) => {
    if (!error) return next()
    const uploadError = new Error(error.code === 'LIMIT_FILE_SIZE'
      ? 'PRD 文档不能超过 10MB'
      : ['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE'].includes(error.code)
        ? '一次最多导入 100 份 PRD 文档'
        : '上传请求格式无效，请重新选择文档')
    uploadError.code = error.code || 'UPLOAD_FAILED'
    handleError(uploadError, response)
  })
}

function uploadedFiles(request) {
  return [...(request.files?.files || []), ...(request.files?.file || [])]
}

function uploadedArchive(request) {
  return request.files?.archive?.[0] || null
}

function duplicatePrdError(duplicate) {
  const error = new Error(`已存在相同内容的 PRD：「${duplicate.existingTitle}」`)
  error.code = 'PRD_DUPLICATE'
  return error
}

async function storeParsedPrds(parsedPrds) {
  let result
  await updateState((state) => {
    result = insertParsedPrds(state, parsedPrds, {
      createId: () => newId('prd'),
      now: () => new Date().toISOString(),
    })
  })
  return result
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
    PRD_DUPLICATE: 409,
    PRD_NOT_FOUND: 404,
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

function featureGroupForPrd(state, prdId) {
  const requestedPrd = state.prds.find((item) => item.id === prdId)
  if (!requestedPrd) {
    const error = new Error('PRD 不存在')
    error.code = 'PRD_NOT_FOUND'
    throw error
  }
  const requestedFeature = applyFeatureIdentity(requestedPrd)
  return groupPrdsByFeature(state.prds).find((group) => group.featureKey === requestedFeature.featureKey)
}

async function runFeatureAnalysis(prdId, options = {}, onProgress = () => {}, signal) {
  const initialState = await readState()
  let featureGroup = featureGroupForPrd(initialState, prdId)
  const allocationProfile = normalizeAllocationProfile(
    options.allocationProfile ?? options.allocationProfiles?.[featureGroup.featureKey],
    developers,
  )
  if (activeFeatureAnalyses.has(featureGroup.featureKey)) {
    const error = new Error('该功能模块正在分析中，请等待当前分析完成')
    error.code = 'ANALYSIS_IN_PROGRESS'
    throw error
  }

  activeFeatureAnalyses.add(featureGroup.featureKey)
  const startedAt = Date.now()
  try {
    const state = initialState
    const featurePrd = mergeFeaturePrds(featureGroup)

    const analysisStartedAt = new Date().toISOString()
    await updateState((draft) => {
      for (const sourcePrdId of featureGroup.prdIds) {
        const storedPrd = draft.prds.find((item) => item.id === sourcePrdId)
        if (!storedPrd) {
          const error = new Error('PRD 已在开始分配前被删除')
          error.code = 'PRD_NOT_FOUND'
          throw error
        }
        markPrdAllocationStarted(storedPrd, analysisStartedAt)
      }
    })

    const configuredModel = config.model
    const configuredReviewModel = config.model
    const reasoningEffort = config.reasoningEffort
    onProgress({ stage: 'context', percent: 6, message: '正在读取工程模块、团队负载和历史调整知识', model: configuredModel, reasoningEffort })
    const relatedKnowledge = retrieveKnowledge(state.knowledge, `${featurePrd.title} ${featurePrd.content}`, 12)
    onProgress({ stage: 'context-ready', percent: 10, message: `分析上下文已准备，共匹配 ${relatedKnowledge.length} 条历史知识`, model: configuredModel })

    const result = await analyzePrd({
      prd: featurePrd,
      knowledge: relatedKnowledge,
      workloads: activeWorkloads(state, developers),
      allocationProfile,
      useReview: options.review !== false,
      reasoningEffort,
      onProgress,
      signal,
    })
    onProgress({ stage: 'saving', percent: 96, message: '正在保存任务分配和分析记录', model: configuredModel })

    const createdAt = new Date().toISOString()
    const tasks = result.tasks.map((task, index) => ({
      id: newId('task'),
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
    let savedTasks = tasks
    await updateState((draft) => {
      const reconciliation = reconcileFeatureTasks(draft, {
        featureKey: featureGroup.featureKey,
        prdIds: featureGroup.prdIds,
        candidates: tasks,
      })
      savedTasks = reconciliation.saved
      for (const sourcePrdId of featureGroup.prdIds) {
        const storedPrd = draft.prds.find((item) => item.id === sourcePrdId)
        if (!storedPrd) throw new Error('PRD 已在分析期间被删除')
        Object.assign(storedPrd, {
          featureKey: featureGroup.featureKey,
          featureName: featureGroup.featureName,
          allocationProfile,
          analyzedAt: createdAt,
          analysisFinishedAt: createdAt,
          analysisError: '',
          updatedAt: createdAt,
          analysisStatus: 'completed',
          taskCount: reconciliation.taskCount,
          summary: result.summary,
          analysisRequestedModel: configuredModel,
          analysisModel: actualModel,
          analysisModelVerified: Boolean(draftTrace.responseModel),
          reviewRequestedModel: configuredReviewModel,
          reviewModel: actualReviewModel,
          reviewModelVerified: Boolean(reviewTrace.responseModel),
          analysisReasoningEffort: reasoningEffort,
          analysisDurationMs: durationMs,
          analysisTrace: result.modelTrace,
        })
      }
      draft.activity.unshift({
        id: newId('act'),
        type: 'analysis',
        title: `已分析 ${featureGroup.featureName}`,
        detail: `${featureGroup.prdIds.length} 份来源文档合并分析；请求 ${configuredModel}，网关${draftTrace.responseModel ? `返回 ${draftTrace.responseModel}` : '未返回模型标识'}；${reasoningEffort} 推理生成 ${savedTasks.length} 个任务${result.reviewed ? `，复核返回 ${actualReviewModel}` : ''}；拆分 ${Math.round((draftTrace.durationMs || 0) / 1000)} 秒，复核 ${Math.round((reviewTrace.durationMs || 0) / 1000)} 秒，总计 ${Math.max(1, Math.round(durationMs / 1000))} 秒`,
        createdAt,
      })
    })
    onProgress({ stage: 'complete', percent: 100, message: `分析完成，网关实际返回 ${actualModel}`, model: actualModel, reasoningEffort })
    return {
      tasks: savedTasks,
      summary: result.summary,
      reviewed: result.reviewed,
      reviewWarning: result.reviewWarning,
      featureKey: featureGroup.featureKey,
      featureName: featureGroup.featureName,
      prdIds: featureGroup.prdIds,
      allocationProfile,
      model: actualModel,
      requestedModel: configuredModel,
      reasoningEffort,
      modelTrace: result.modelTrace,
      durationMs,
    }
  } catch (error) {
    const analysisFinishedAt = new Date().toISOString()
    await updateState((draft) => {
      for (const sourcePrdId of featureGroup?.prdIds || [prdId]) {
        const storedPrd = draft.prds.find((item) => item.id === sourcePrdId)
        if (storedPrd?.analysisStatus === 'analyzing') {
          markPrdAllocationFailed(storedPrd, error.message, analysisFinishedAt)
        }
      }
    })
    throw error
  } finally {
    activeFeatureAnalyses.delete(featureGroup.featureKey)
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

app.post('/api/prds/upload', receivePrdFiles, async (request, response) => {
  try {
    const files = uploadedFiles(request)
    const archive = uploadedArchive(request)
    if (!files.length && !archive) throw new Error('请选择要上传的 PRD 文档、文件夹或 ZIP 包')
    const outcomes = await parsePrdUpload({ files, archive })
    const stored = await storeParsedPrds(outcomes.parsed)
    response.status(stored.imported.length ? 201 : 200).json({
      imported: stored.imported.map(toPublicPrd),
      duplicates: stored.duplicates,
      failed: outcomes.failed,
    })
  } catch (error) {
    handleError(error, response)
  }
})

app.post('/api/prds/url', async (request, response) => {
  try {
    const parsed = await fetchOnlineDocument(request.body.url)
    const stored = await storeParsedPrds([{ ...parsed, sourceType: 'url' }])
    if (!stored.imported.length) throw duplicatePrdError(stored.duplicates[0])
    response.status(201).json(toPublicPrd(stored.imported[0]))
  } catch (error) {
    handleError(error, response)
  }
})

app.post('/api/prds/text', async (request, response) => {
  try {
    const content = String(request.body.content || '').trim()
    if (content.length < 20) throw new Error('PRD 正文至少需要 20 个字符')
    const stored = await storeParsedPrds([{
      title: String(request.body.title || '粘贴的 PRD').slice(0, 80),
      content,
      sourceType: 'text',
      sourceLabel: '手动粘贴',
    }])
    if (!stored.imported.length) throw duplicatePrdError(stored.duplicates[0])
    response.status(201).json(toPublicPrd(stored.imported[0]))
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
      const deletedTaskCount = removePrdFromFeatureTasks(state, prd.id)
      const createdAt = new Date().toISOString()
      state.activity.unshift({
        id: newId('act'),
        type: 'deletion',
        title: `已删除 ${prd.title}`,
        detail: `同时移除 ${deletedTaskCount} 个关联任务，历史调整知识保留`,
        createdAt,
      })
      deleted = { id: prd.id, title: prd.title, deletedTaskCount }
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
      return response.json(await runFeatureAnalysis(request.params.id, request.body))
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
  const controller = new AbortController()
  const stageCount = request.body.review === false ? 1 : 2
  const deadline = setTimeout(() => controller.abort(new DOMException('分析请求超时', 'TimeoutError')), config.modelRequestTimeoutMs * stageCount + 30000)
  const stopWhenClientDisconnects = () => {
    if (!response.writableEnded) controller.abort(new DOMException('浏览器已断开分析连接', 'AbortError'))
  }
  request.once('aborted', stopWhenClientDisconnects)
  response.once('close', stopWhenClientDisconnects)
  let lastProgress = { stage: 'connecting', percent: 2, message: '正在连接模型服务', model: config.model, reasoningEffort: config.reasoningEffort }
  const reportProgress = (progress) => {
    lastProgress = mergeAnalysisProgress(lastProgress, progress)
    writeSse(response, 'progress', { ...lastProgress, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) })
  }
  reportProgress(lastProgress)
  const heartbeat = setInterval(() => {
    reportProgress({ heartbeat: true, waitingForOutput: Boolean(lastProgress.waitingForOutput) })
  }, 10000)

  try {
    const result = await runFeatureAnalysis(request.params.id, request.body, reportProgress, controller.signal)
    writeSse(response, 'result', result)
  } catch (error) {
    writeSse(response, 'error', { error: error.message || '请求处理失败', code: error.code || 'REQUEST_FAILED' })
  } finally {
    clearInterval(heartbeat)
    clearTimeout(deadline)
    request.off('aborted', stopWhenClientDisconnects)
    response.off('close', stopWhenClientDisconnects)
    response.end()
  }
})

app.post('/api/prds/analyze-batch', async (request, response) => {
  const prdIds = uniquePrdIds(request.body.prdIds)
  if (!prdIds.length) return handleError(new Error('请至少选择一份 PRD'), response)

  let featureGroups
  let allocationProfiles
  try {
    const state = await readState()
    featureGroups = featureGroupsForPrdIds(state.prds, prdIds).map((selectedGroup) => {
      const sourcePrd = selectedGroup.prds[0]
      return featureGroupForPrd(state, sourcePrd.id)
    })
    allocationProfiles = profilesForFeatureGroups(featureGroups, request.body.allocationProfiles, developers)
  } catch (error) {
    return handleError(error, response)
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

  let activeController = null
  let disconnected = false
  const abortOnDisconnect = () => {
    disconnected = true
    activeController?.abort(new DOMException('浏览器已断开分析连接', 'AbortError'))
  }
  request.once('aborted', abortOnDisconnect)
  response.once('close', abortOnDisconnect)

  writeSse(response, 'batch-start', { total: featureGroups.length, prdIds, featureGroups: featureGroups.map(({ featureKey, featureName, prdIds: sourcePrdIds }) => ({ featureKey, featureName, prdIds: sourcePrdIds })) })
  const batch = await runSequentialFeatureAnalysis(featureGroups, async (featureGroup) => {
    if (disconnected) {
      const error = new Error('浏览器已断开分析连接')
      error.code = 'REQUEST_ABORTED'
      throw error
    }

    const index = featureGroups.findIndex((group) => group.featureKey === featureGroup.featureKey)
    const item = {
      index,
      total: featureGroups.length,
      featureKey: featureGroup.featureKey,
      featureName: featureGroup.featureName,
      prdIds: featureGroup.prdIds,
      prdId: featureGroup.prdIds[0],
      title: featureGroup.featureName,
    }
    writeSse(response, 'batch-item-start', item)

    activeController = new AbortController()
    let lastItemProgress = { stage: 'connecting', percent: 2, message: '正在连接模型服务', model: config.model, reasoningEffort: config.reasoningEffort }
    const stageCount = request.body.review === false ? 1 : 2
    const deadline = setTimeout(() => activeController.abort(new DOMException('分析请求超时', 'TimeoutError')), config.modelRequestTimeoutMs * stageCount + 30000)
    const heartbeat = setInterval(() => {
      writeSse(response, 'batch-progress', {
        ...item,
        progress: { ...lastItemProgress, heartbeat: true, waitingForOutput: Boolean(lastItemProgress.waitingForOutput) },
      })
    }, 10000)
    try {
      const result = await runFeatureAnalysis(item.prdId, {
        review: request.body.review,
        allocationProfile: allocationProfiles[featureGroup.featureKey],
      }, (progress) => {
        lastItemProgress = { ...lastItemProgress, ...progress }
        writeSse(response, 'batch-progress', { ...item, progress: lastItemProgress })
      }, activeController.signal)
      writeSse(response, 'batch-item-result', { ...item, result })
      return result
    } catch (error) {
      writeSse(response, 'batch-item-error', { ...item, error: error.message || '分析失败', code: error.code || 'REQUEST_FAILED' })
      throw error
    } finally {
      clearTimeout(deadline)
      clearInterval(heartbeat)
      activeController = null
    }
  })

  if (!disconnected) {
    writeSse(response, 'batch-complete', batch)
    response.end()
  }
  request.off('aborted', abortOnDisconnect)
  response.off('close', abortOnDisconnect)
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
      assertEligibleReassignment(task, assignee, developers)
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
    response.json(await suggestReassignment({ task, knowledge, workloads: activeWorkloads(state, developers, task.id) }))
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

async function startServer() {
  const initialState = await readState()
  if (initialState.prds.some((prd) => prd.analysisStatus === 'analyzing')) {
    const recoveredAt = new Date().toISOString()
    let recovered = 0
    await updateState((state) => {
      recovered = recoverInterruptedPrdAllocations(state, recoveredAt)
    })
    console.warn(`Recovered ${recovered} interrupted PRD allocation(s) after restart`)
  }

  app.listen(config.port, config.host, () => {
    console.log(`DevFlow API listening on http://${config.host}:${config.port}`)
  })
}

startServer().catch((error) => {
  console.error('DevFlow API failed to start', error)
  process.exitCode = 1
})
