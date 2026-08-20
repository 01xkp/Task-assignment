import assert from 'node:assert/strict'
import test from 'node:test'

process.env.OPENAI_API_KEY = 'test-key'

const { analyzePrd, readResponsePayloadForTest } = await import('../server/model.js')

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

test('forwards the accepted gateway event before model text arrives', async () => {
  const encoder = new TextEncoder()
  const events = []
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: response.created\ndata: {"type":"response.created","response":{"status":"in_progress"}}\n\n'))
      controller.close()
    },
  }), { headers: { 'content-type': 'text/event-stream' } })

  await readResponsePayloadForTest(response, (event) => events.push(event))

  assert.deepEqual(events, [{ eventType: 'response.created', accepted: true, waitingForOutput: true }])
})
