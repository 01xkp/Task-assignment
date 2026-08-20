import { config } from './config.js'
import { developers } from './storage.js'
import { formatKnowledge } from './knowledge.js'
import { formatProjectContext, supportedPlatforms } from './project-context.js'
import { modelLifecycleProgress } from './model-progress.js'

const allocationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'tasks'],
  properties: {
    summary: { type: 'string' },
    tasks: {
      type: 'array',
      minItems: 1,
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'module', 'modulePath', 'workType', 'platforms', 'priority', 'estimateHours', 'suggestedAssignee', 'reasoning', 'acceptanceCriteria', 'dependencies'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          module: { type: 'string' },
          modulePath: { type: 'string' },
          workType: { type: 'string', enum: ['共享实现', '平台适配', '平台验收'] },
          platforms: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: { type: 'string', enum: supportedPlatforms },
          },
          priority: { type: 'string', enum: ['高', '中', '低'] },
          estimateHours: { type: 'number', minimum: 1, maximum: 80 },
          suggestedAssignee: { type: 'string', enum: developers.map((item) => item.name) },
          reasoning: { type: 'string' },
          acceptanceCriteria: { type: 'array', items: { type: 'string' }, minItems: 1 },
          dependencies: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

function endpoint() {
  return config.baseUrl.endsWith('/v1')
    ? `${config.baseUrl}/responses`
    : `${config.baseUrl}/v1/responses`
}

function extractOutputText(payload) {
  if (payload.output_text) return payload.output_text
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((item) => item.text || item.output_text || '')
    .join('')
}

function parseJsonText(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('模型未返回可解析的 JSON')
  return JSON.parse(cleaned.slice(start, end + 1))
}

async function readResponsePayload(response, onStreamProgress) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) return response.json()

  const decoder = new TextDecoder()
  let buffer = ''
  let completedResponse = null
  let outputText = ''
  let streamError = null
  let lastReportedLength = 0

  function consumeEvent(block) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (!data || data === '[DONE]') return
    const event = JSON.parse(data)
    const lifecycle = modelLifecycleProgress(event.type)
    if (lifecycle) onStreamProgress?.({ eventType: event.type, ...lifecycle })
    if (event.type === 'response.output_text.delta') {
      outputText += event.delta || ''
      if (outputText.length - lastReportedLength >= 240 || lastReportedLength === 0) {
        lastReportedLength = outputText.length
        onStreamProgress?.({ outputChars: outputText.length })
      }
    }
    if (event.type === 'response.completed') completedResponse = event.response
    if (event.type === 'error' || event.type === 'response.failed') {
      streamError = event.error || event.response?.error || { message: '模型流式响应失败' }
    }
  }

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true })
    let boundary = buffer.match(/\r?\n\r?\n/)
    while (boundary?.index != null) {
      consumeEvent(buffer.slice(0, boundary.index))
      buffer = buffer.slice(boundary.index + boundary[0].length)
      boundary = buffer.match(/\r?\n\r?\n/)
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) consumeEvent(buffer)

  if (streamError) {
    const error = new Error(streamError.message || '模型流式响应失败')
    error.code = 'MODEL_STREAM_FAILED'
    throw error
  }
  if (outputText.length > lastReportedLength) onStreamProgress?.({ outputChars: outputText.length })
  return completedResponse || { output_text: outputText }
}

export async function readResponsePayloadForTest(response, onStreamProgress) {
  return readResponsePayload(response, onStreamProgress)
}

function modelTimeoutError() {
  const error = new Error(`模型在 ${Math.round(config.modelRequestTimeoutMs / 60000)} 分钟内未返回，请检查模型服务或降低推理强度后重试。`)
  error.code = 'MODEL_TIMEOUT'
  return error
}

function normalizeModelRequestError(error, requestSignal) {
  if (error?.name === 'TimeoutError' || requestSignal?.reason?.name === 'TimeoutError') return modelTimeoutError()
  return error
}

async function requestModel({ model, system, user, schema, schemaName = 'result', reasoningEffort = config.reasoningEffort, onStreamProgress, includeMetadata = false, signal }) {
  if (!config.apiKey) {
    const error = new Error('尚未配置 OPENAI_API_KEY')
    error.code = 'MODEL_NOT_CONFIGURED'
    throw error
  }

  const baseBody = {
    model,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: system }] },
      { role: 'user', content: [{ type: 'input_text', text: user }] },
    ],
    reasoning: { effort: reasoningEffort },
    store: !config.disableResponseStorage,
    stream: true,
  }
  const body = schema
    ? { ...baseBody, text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } } }
    : baseBody
  let activeSignal

  async function send(payload, maxAttempts = 3) {
    let response
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const timeoutSignal = AbortSignal.timeout(config.modelRequestTimeoutMs)
      const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
      activeSignal = requestSignal
      try {
        response = await fetch(endpoint(), {
          method: 'POST',
          headers: {
            accept: 'text/event-stream',
            authorization: `Bearer ${config.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: requestSignal,
        })
      } catch (error) {
        throw normalizeModelRequestError(error, requestSignal)
      }
      if (response.ok || ![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === maxAttempts - 1) return response
      await response.arrayBuffer()
      await new Promise((resolve) => setTimeout(resolve, 750 * (2 ** attempt)))
    }
    return response
  }

  let response = await send(body, schema ? 1 : 3)

  if (!response.ok && schema && [400, 408, 413, 429, 500, 502, 503, 504].includes(response.status)) {
    await response.arrayBuffer()
    const jsonFallbackBody = {
      ...baseBody,
      input: [
        ...baseBody.input,
        {
          role: 'user',
          content: [{
            type: 'input_text',
            text: `严格只返回一个可由 JSON.parse 解析的 JSON 对象，不要使用 Markdown 代码块。返回值必须符合以下 JSON Schema：\n${JSON.stringify(schema)}`,
          }],
        },
      ],
    }
    response = await send(jsonFallbackBody)
  }

  if (!response.ok) {
    const detail = await response.text()
    const contentType = response.headers.get('content-type') || ''
    const isGatewayHtml = response.status >= 500 && contentType.includes('text/html')
    const error = new Error(isGatewayHtml
      ? `模型服务网关暂时不可用（${response.status}），请稍后重试。`
      : `模型请求失败（${response.status}）：${detail.slice(0, 240)}`)
    error.code = response.status === 429 ? 'MODEL_RATE_LIMITED' : response.status >= 500 ? 'MODEL_GATEWAY_ERROR' : 'MODEL_REQUEST_FAILED'
    error.status = response.status
    throw error
  }
  let payload
  try {
    payload = await readResponsePayload(response, onStreamProgress)
  } catch (error) {
    throw normalizeModelRequestError(error, activeSignal)
  }
  const data = parseJsonText(extractOutputText(payload))
  if (!includeMetadata) return data
  const usage = payload.usage || {}
  return {
    data,
    metadata: {
      requestedModel: model,
      responseModel: String(payload.model || ''),
      reasoningEffort,
      inputTokens: Number(usage.input_tokens || 0),
      outputTokens: Number(usage.output_tokens || 0),
      reasoningTokens: Number(usage.output_tokens_details?.reasoning_tokens || 0),
    },
  }
}

function teamContext(workloads = {}) {
  return developers.map((developer) => {
    const load = workloads[developer.name] || 0
    return `- ${developer.name}｜主责：${developer.role}｜主责平台：${developer.primaryPlatforms.join('、')}｜技能：${developer.skills.join('、')}｜全平台未完成工时：${load}h/${developer.weeklyCapacity}h`
  }).join('\n')
}

function normalizePlatforms(platforms) {
  const values = Array.isArray(platforms)
    ? [...new Set(platforms.filter((platform) => supportedPlatforms.includes(platform)))]
    : []
  return values.length ? values : ['共享 Flutter']
}

function normalizeAllocation(result) {
  return {
    summary: String(result.summary || '已完成任务拆解'),
    tasks: (result.tasks || []).map((task) => ({
      title: String(task.title || '未命名任务').slice(0, 100),
      description: String(task.description || ''),
      module: String(task.module || '未分类').slice(0, 40),
      modulePath: String(task.modulePath || 'lib/features').slice(0, 120),
      workType: ['共享实现', '平台适配', '平台验收'].includes(task.workType) ? task.workType : '共享实现',
      platforms: normalizePlatforms(task.platforms),
      priority: ['高', '中', '低'].includes(task.priority) ? task.priority : '中',
      estimateHours: Math.min(80, Math.max(1, Number(task.estimateHours) || 4)),
      suggestedAssignee: developers.some((item) => item.name === task.suggestedAssignee) ? task.suggestedAssignee : developers[0].name,
      reasoning: String(task.reasoning || '基于技能匹配与当前负载分配。'),
      acceptanceCriteria: Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria.map(String) : [],
      dependencies: Array.isArray(task.dependencies) ? task.dependencies.map(String) : [],
    })),
  }
}

export async function analyzePrd({ prd, knowledge, workloads, useReview = true, reasoningEffort = config.reasoningEffort, onProgress, signal }) {
  const model = config.model
  const reviewModel = config.model
  const system = `你是 Agino Flutter 多端客户端的资深研发项目经理。只生成 Flutter 客户端开发、平台适配和客户端验收任务，只能分配给给定三位开发者。

拆分规则：
1. 先识别受影响的真实业务模块和代码目录，再判断 Android、iOS、macOS、Windows、Linux 的影响面；不得因为项目支持五个平台就机械地为所有平台生成任务。
2. 跨平台共用的 Dart、Repository、ViewModel、Domain 或 Widget 实现只创建一条“共享实现”任务，不得按平台复制。只有原生配置、权限、生命周期、桌面窗口/托盘、平台差异交互和真实设备验收才拆为“平台适配”或“平台验收”。
3. 平台专属工作优先由主责人承接：向坤朋负责 Windows/Linux，曾雨秋负责 Android，张徐负责 iOS/macOS。共享实现不绑定平台主责，按照技能、模块上下文和全平台未完成总工时分配。
4. 负载计算必须覆盖每个人所有平台的现有未完成工时，并累加本次方案内已分配工时；不能只比较某一个平台。优先避免超过 40h，不能为了平均而把平台原生工作交给非主责人。
5. 每项任务必须提供真实 module、modulePath、workType、platforms、明确验收标准和标题依赖。不要生成产品、设计、后端、发布管理或纯会议任务。
6. 输入可能包含同一业务功能的开发说明、交付说明和验收说明等多份来源文档。它们是互补材料，不是独立需求；必须只输出一套覆盖完整功能的任务，不能按来源文档重复共享实现、平台适配或平台验收。`
  const user = `工程上下文：\n${formatProjectContext()}\n\n团队与全平台负载：\n${teamContext(workloads)}\n\n历史调整知识：\n${formatKnowledge(knowledge)}\n\n功能模块：${prd.featureName || prd.title}\n来源 PRD 标题：${prd.title}\nPRD 正文：\n${prd.content.slice(0, 50000)}\n\n输出可独立交付的 Flutter 客户端任务。依赖项填写所依赖任务的标题，summary 说明各平台影响面和三人分配后的总工时。`
  onProgress?.({ stage: 'draft', percent: 14, message: `${model} 正在以 ${reasoningEffort} 强度拆解需求`, model, reasoningEffort })
  const draftStartedAt = Date.now()
  const draftResponse = await requestModel({
    model,
    system,
    user,
    schema: allocationSchema,
    schemaName: 'task_allocation',
    reasoningEffort,
    includeMetadata: true,
    signal,
    onStreamProgress: (stream) => {
      if (stream.accepted) {
        onProgress?.({
          stage: 'draft-accepted',
          percent: 16,
          message: '模型已接受请求，正在高强度推理',
          model,
          reasoningEffort,
          waitingForOutput: true,
        })
      }
      if (Number.isFinite(stream.outputChars)) {
        onProgress?.({
          stage: 'draft',
          percent: Math.min(50, 18 + Math.floor(stream.outputChars / 400)),
          message: '正在生成模块任务、平台影响和工时分配',
          model,
          reasoningEffort,
          waitingForOutput: false,
        })
      }
    },
  })
  const draft = normalizeAllocation(draftResponse.data)
  const draftTrace = { ...draftResponse.metadata, durationMs: Date.now() - draftStartedAt, status: 'completed' }
  onProgress?.({
    stage: 'draft-complete',
    percent: 55,
    message: `首次拆分完成，网关返回 ${draftTrace.responseModel || '未标识模型'}，共 ${draft.tasks.length} 个候选任务`,
    model: draftTrace.responseModel || model,
    reasoningEffort,
  })

  if (!useReview) {
    onProgress?.({ stage: 'review-skipped', percent: 92, message: '已跳过模型复核，准备保存任务', model })
    return {
      ...draft,
      reviewed: false,
      modelTrace: {
        draft: draftTrace,
        review: { requestedModel: reviewModel, responseModel: '', reasoningEffort, durationMs: 0, status: 'skipped' },
      },
    }
  }
  const reviewStartedAt = Date.now()
  try {
    const reviewSystem = `你是 Agino Flutter 多端任务复核者。检查业务模块和代码路径是否真实、共享 Flutter 实现是否被错误地按平台重复、受影响平台是否遗漏、平台专属任务是否交给对应主责人，以及按现有工时加本次任务后的全平台总负载是否合理。输入的多份来源材料属于同一功能模块，不得为每份来源保留重复任务。检查依赖闭环和验收标准后，直接返回修正后的完整方案。只能使用给定三位开发者，不得加入后端或产品任务。`
    const reviewUser = `工程上下文：\n${formatProjectContext()}\n\n团队与全平台负载：\n${teamContext(workloads)}\n\n历史调整知识：\n${formatKnowledge(knowledge)}\n\n功能模块：${prd.featureName || prd.title}\nPRD：\n${prd.content.slice(0, 35000)}\n\n待复核方案：\n${JSON.stringify(draft)}`
    onProgress?.({ stage: 'review', percent: 62, message: `${reviewModel} 正在以 ${reasoningEffort} 强度复核方案`, model: reviewModel, reasoningEffort })
    const reviewResponse = await requestModel({
      model: reviewModel,
      system: reviewSystem,
      user: reviewUser,
      schema: allocationSchema,
      schemaName: 'reviewed_allocation',
      reasoningEffort,
      includeMetadata: true,
      signal,
      onStreamProgress: (stream) => {
        if (stream.accepted) {
          onProgress?.({
            stage: 'review-accepted',
            percent: 64,
            message: '模型已接受复核请求，正在高强度推理',
            model: reviewModel,
            reasoningEffort,
            waitingForOutput: true,
          })
        }
        if (Number.isFinite(stream.outputChars)) {
          onProgress?.({
            stage: 'review',
            percent: Math.min(90, 66 + Math.floor(stream.outputChars / 500)),
            message: '正在校验任务覆盖、主责平台和验收标准',
            model: reviewModel,
            reasoningEffort,
            waitingForOutput: false,
          })
        }
      },
    })
    const reviewed = normalizeAllocation(reviewResponse.data)
    const reviewTrace = { ...reviewResponse.metadata, durationMs: Date.now() - reviewStartedAt, status: 'completed' }
    onProgress?.({
      stage: 'review-complete',
      percent: 93,
      message: `复核完成，网关返回 ${reviewTrace.responseModel || '未标识模型'}`,
      model: reviewTrace.responseModel || reviewModel,
      reasoningEffort,
    })
    return { ...reviewed, reviewed: true, modelTrace: { draft: draftTrace, review: reviewTrace } }
  } catch (error) {
    onProgress?.({ stage: 'review-warning', percent: 93, message: '复核未完成，将保存首次拆分结果', model: reviewModel })
    return {
      ...draft,
      reviewed: false,
      reviewWarning: error.message,
      modelTrace: {
        draft: draftTrace,
        review: { requestedModel: reviewModel, responseModel: '', reasoningEffort, durationMs: Date.now() - reviewStartedAt, status: 'failed', error: error.message },
      },
    }
  }
}

export async function suggestReassignment({ task, knowledge, workloads }) {
  const candidates = developers.filter((item) => item.name !== task.assignee).map((item) => item.name)
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['assignee', 'reasoning'],
    properties: {
      assignee: { type: 'string', enum: candidates },
      reasoning: { type: 'string' },
    },
  }
  const system = '你是 Agino Flutter 多端任务调度者。针对被拒绝或需要调整的任务，从候选人中推荐一人。平台专属任务优先遵守 Windows/Linux、Android、iOS/macOS 的主责边界；共享实现按所有平台未完成总工时、技能和模块上下文平衡。结合历史原因避免重复冲突。'
  const user = `工程：${formatProjectContext()}\n\n任务：${JSON.stringify(task)}\n\n团队全平台负载：\n${teamContext(workloads)}\n\n相关历史：\n${formatKnowledge(knowledge)}\n\n候选人：${candidates.join('、')}`
  return requestModel({ model: config.model, system, user, schema, schemaName: 'reassignment' })
}
