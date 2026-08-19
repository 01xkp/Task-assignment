import assert from 'node:assert/strict'
import test from 'node:test'
import { api } from '../src/api.js'

test('stops a stalled analysis request at the client deadline', async (context) => {
  const originalFetch = globalThis.fetch
  let receivedSignal
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    receivedSignal = options.signal
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  })
  context.after(() => { globalThis.fetch = originalFetch })

  await assert.rejects(
    () => api.analyzePrd('prd-stalled', false, { timeoutMs: 20 }),
    (error) => {
      assert.equal(receivedSignal.aborted, true)
      assert.equal(error.code, 'ANALYSIS_TIMEOUT')
      return true
    },
  )
})

test('starts a separate client deadline when the review stage begins', async (context) => {
  const originalFetch = globalThis.fetch
  const encoder = new TextEncoder()
  let abortedAt = 0
  globalThis.fetch = async (_url, options) => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: progress\ndata: {"stage":"review","percent":62}\n\n'))
      options.signal.addEventListener('abort', () => {
        abortedAt = Date.now()
        controller.error(options.signal.reason)
      }, { once: true })
    },
  }), {
    headers: { 'content-type': 'text/event-stream' },
  })
  context.after(() => { globalThis.fetch = originalFetch })

  const startedAt = Date.now()
  await assert.rejects(
    () => api.analyzePrd('prd-review-stalled', true, { timeoutMs: 35 }),
    (error) => error.code === 'ANALYSIS_TIMEOUT',
  )
  assert.ok(abortedAt - startedAt >= 55)
})
