import assert from 'node:assert/strict'
import test from 'node:test'
import { api } from '../src/api.js'

test('sends allocation profiles with a batch analysis request', async () => {
  const originalFetch = globalThis.fetch
  let body
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body)
    return new Response('event: batch-complete\ndata: {"succeeded":[],"failed":[]}\n\n')
  }

  try {
    await api.analyzePrds(['prd-invite'], {
      review: false,
      allocationProfiles: {
        'folder:invite': {
          frontendDeveloperIds: ['zeng-yuqiu'],
          includeBackend: true,
          backendOwnerId: 'shu-jie',
        },
      },
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.deepEqual(body.allocationProfiles, {
    'folder:invite': {
      frontendDeveloperIds: ['zeng-yuqiu'],
      includeBackend: true,
      backendOwnerId: 'shu-jie',
    },
  })
})
