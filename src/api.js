async function request(url, options = {}) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || '请求失败，请稍后重试')
    error.code = data.code
    throw error
  }
  return data
}

async function readAnalysisStream(response, onProgress) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) return response.json()

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null
  let streamError = null

  function consumeEvent(block) {
    const event = block.split(/\r?\n/).find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message'
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (!data) return
    const payload = JSON.parse(data)
    if (event === 'progress') onProgress?.(payload)
    if (event === 'result') result = payload
    if (event === 'error') {
      streamError = new Error(payload.error || '模型分析失败')
      streamError.code = payload.code
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    let boundary = buffer.match(/\r?\n\r?\n/)
    while (boundary?.index != null) {
      consumeEvent(buffer.slice(0, boundary.index))
      buffer = buffer.slice(boundary.index + boundary[0].length)
      boundary = buffer.match(/\r?\n\r?\n/)
    }
    if (done) break
  }
  if (buffer.trim()) consumeEvent(buffer)
  if (streamError) throw streamError
  if (!result) throw new Error('模型分析连接已结束，但没有收到任务结果')
  return result
}

export function analysisTimeoutMs(requestTimeoutSeconds = 360, review = true) {
  const stageTimeoutSeconds = Math.max(30, Number(requestTimeoutSeconds) || 360)
  const stageCount = review ? 2 : 1
  return (stageTimeoutSeconds * stageCount + 30) * 1000
}

function analysisStageTimeoutMs(requestTimeoutSeconds) {
  return analysisTimeoutMs(requestTimeoutSeconds, false)
}

function analysisTimeoutError(timeoutMs) {
  const error = new Error(`分析超过 ${Math.ceil(timeoutMs / 60000)} 分钟未完成，已停止等待。请检查模型服务后重试。`)
  error.code = 'ANALYSIS_TIMEOUT'
  return error
}

export const api = {
  state: () => request('/api/state'),
  uploadPrd(file) {
    const form = new FormData()
    form.append('file', file)
    return request('/api/prds/upload', { method: 'POST', body: form })
  },
  importUrl(url) {
    return request('/api/prds/url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  },
  importText(title, content) {
    return request('/api/prds/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, content }),
    })
  },
  async analyzePrd(id, review = true, { onProgress, requestTimeoutSeconds, timeoutMs } = {}) {
    const effectiveTimeoutMs = Math.max(1, Number(timeoutMs) || analysisStageTimeoutMs(requestTimeoutSeconds))
    const controller = new AbortController()
    let timeout
    const scheduleDeadline = () => {
      globalThis.clearTimeout(timeout)
      timeout = globalThis.setTimeout(() => controller.abort(analysisTimeoutError(effectiveTimeoutMs)), effectiveTimeoutMs)
    }
    scheduleDeadline()
    let reviewDeadlineStarted = false
    const reportProgress = (progress) => {
      if (review && !reviewDeadlineStarted && progress.stage === 'review') {
        reviewDeadlineStarted = true
        scheduleDeadline()
      }
      onProgress?.(progress)
    }
    try {
      const response = await fetch(`/api/prds/${id}/analyze`, {
        method: 'POST',
        headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
        body: JSON.stringify({ review }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const error = new Error(data.error || '模型分析请求失败')
        error.code = data.code
        throw error
      }
      return await readAnalysisStream(response, reportProgress)
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason?.code === 'ANALYSIS_TIMEOUT') throw controller.signal.reason
      throw error
    } finally {
      globalThis.clearTimeout(timeout)
    }
  },
  deletePrd(id) {
    return request(`/api/prds/${id}`, { method: 'DELETE' })
  },
  deleteKnowledge(id) {
    return request(`/api/knowledge/${id}`, { method: 'DELETE' })
  },
  rejectTask(id, reason) {
    return request(`/api/tasks/${id}/reject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
  },
  reassignTask(id, assignee, reason, note, source = 'human') {
    return request(`/api/tasks/${id}/reassign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assignee, reason, note, source }),
    })
  },
  suggestReassignment(id) {
    return request(`/api/tasks/${id}/suggest-reassignment`, { method: 'POST' })
  },
  updateTaskStatus(id, status) {
    return request(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  },
}
