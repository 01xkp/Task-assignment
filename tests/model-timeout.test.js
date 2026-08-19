import assert from 'node:assert/strict'
import test from 'node:test'

process.env.OPENAI_API_KEY = 'test-key'

const { analyzePrd } = await import('../server/model.js')

test('maps a timeout while reading a model stream to MODEL_TIMEOUT', async (context) => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      queueMicrotask(() => controller.error(new DOMException('timed out', 'TimeoutError')))
    },
  }), {
    headers: { 'content-type': 'text/event-stream' },
  })
  context.after(() => { globalThis.fetch = originalFetch })

  await assert.rejects(
    () => analyzePrd({
      prd: { title: 'Timeout test', content: 'This is a minimal PRD for timeout handling.' },
      knowledge: [],
      workloads: {},
      useReview: false,
    }),
    (error) => {
      assert.equal(error.code, 'MODEL_TIMEOUT')
      return true
    },
  )
})
