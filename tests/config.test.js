import assert from 'node:assert/strict'
import test from 'node:test'

process.env.OPENAI_MODEL = 'configured-model'
process.env.OPENAI_REVIEW_MODEL = 'must-not-be-used'

const { config, publicModelConfig } = await import('../server/config.js')

test('only exposes OPENAI_MODEL for analysis status', () => {
  const publicConfig = publicModelConfig()

  assert.equal(config.model, 'configured-model')
  assert.equal(Object.hasOwn(config, 'reviewModel'), false)
  assert.equal(publicConfig.model, 'configured-model')
  assert.equal(Object.hasOwn(publicConfig, 'reviewModel'), false)
  assert.equal(Object.hasOwn(publicConfig, 'availableModels'), false)
})
