import path from 'node:path'
import dotenv from 'dotenv'

const root = process.cwd()
dotenv.config({ path: path.join(root, '.env.local') })
dotenv.config({ path: path.join(root, '.env') })

function asBoolean(value, fallback) {
  if (value == null) return fallback
  return String(value).toLowerCase() === 'true'
}

export const analysisModels = [
  { id: 'gpt-5.6-sol', label: '5.6 Sol', description: '质量优先' },
  { id: 'gpt-5.6-terra', label: '5.6 Terra', description: '速度与质量均衡' },
  { id: 'gpt-5.6-luna', label: '5.6 Luna', description: '速度优先' },
]

const analysisModelIds = new Set(analysisModels.map((model) => model.id))

export function resolveAnalysisModel(model, fallback) {
  if (!model) return fallback
  if (!analysisModelIds.has(model)) {
    const error = new Error('请选择有效的 GPT-5.6 分析模型')
    error.code = 'INVALID_MODEL'
    throw error
  }
  return model
}

export const config = {
  port: Number(process.env.PORT || 5174),
  host: process.env.DEVFLOW_HOST || '0.0.0.0',
  apiKey: process.env.OPENAI_API_KEY || '',
  baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, ''),
  model: process.env.OPENAI_MODEL || 'gpt-5.6-sol',
  reviewModel: process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-sol',
  reasoningEffort: process.env.OPENAI_REASONING_EFFORT || 'xhigh',
  modelRequestTimeoutMs: Math.max(30000, Number(process.env.OPENAI_REQUEST_TIMEOUT_MS || 360000)),
  disableResponseStorage: asBoolean(process.env.OPENAI_DISABLE_RESPONSE_STORAGE, true),
  dataFile: path.join(root, 'data', 'workspace.json'),
}

export function publicModelConfig() {
  return {
    provider: 'OpenAI',
    model: config.model,
    reviewModel: config.reviewModel,
    reasoningEffort: config.reasoningEffort,
    responseStorageDisabled: config.disableResponseStorage,
    configured: Boolean(config.apiKey),
    availableModels: analysisModels,
    requestTimeoutSeconds: Math.round(config.modelRequestTimeoutMs / 1000),
  }
}
