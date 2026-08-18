import path from 'node:path'
import dotenv from 'dotenv'

const root = process.cwd()
dotenv.config({ path: path.join(root, '.env.local') })
dotenv.config({ path: path.join(root, '.env') })

function asBoolean(value, fallback) {
  if (value == null) return fallback
  return String(value).toLowerCase() === 'true'
}

export const config = {
  port: Number(process.env.PORT || 5174),
  host: process.env.DEVFLOW_HOST || '0.0.0.0',
  apiKey: process.env.OPENAI_API_KEY || '',
  baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, ''),
  model: process.env.OPENAI_MODEL || 'gpt-5.6-sol',
  reasoningEffort: process.env.OPENAI_REASONING_EFFORT || 'xhigh',
  modelRequestTimeoutMs: Math.max(30000, Number(process.env.OPENAI_REQUEST_TIMEOUT_MS || 360000)),
  disableResponseStorage: asBoolean(process.env.OPENAI_DISABLE_RESPONSE_STORAGE, true),
  dataFile: path.join(root, 'data', 'workspace.json'),
}

export function publicModelConfig() {
  return {
    provider: 'OpenAI',
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    responseStorageDisabled: config.disableResponseStorage,
    configured: Boolean(config.apiKey),
    requestTimeoutSeconds: Math.round(config.modelRequestTimeoutMs / 1000),
  }
}
