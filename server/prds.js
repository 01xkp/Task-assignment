import crypto from 'node:crypto'

export function normalizePrdContent(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function fingerprintPrdContent(content) {
  return crypto.createHash('sha256').update(normalizePrdContent(content), 'utf8').digest('hex')
}

export function sortPrdsNewestFirst(prds) {
  return prds.map((prd, index) => ({ prd, index })).sort((left, right) => {
    const rightTime = right.prd.updatedAt || right.prd.createdAt || ''
    const leftTime = left.prd.updatedAt || left.prd.createdAt || ''
    return rightTime.localeCompare(leftTime) || left.index - right.index
  }).map(({ prd }) => prd)
}

export function insertParsedPrds(state, parsedPrds, { createId, now }) {
  const known = new Map(state.prds.map((prd) => [prd.contentFingerprint || fingerprintPrdContent(prd.content), prd]))
  const imported = []
  const duplicates = []

  for (const parsed of parsedPrds) {
    const contentFingerprint = fingerprintPrdContent(parsed.content)
    const existing = known.get(contentFingerprint)
    if (existing) {
      duplicates.push({ title: parsed.title, sourceLabel: parsed.sourceLabel, existingPrdId: existing.id, existingTitle: existing.title })
      continue
    }

    const createdAt = now()
    const prd = { id: createId(), ...parsed, contentFingerprint, createdAt, updatedAt: createdAt, analysisStatus: 'ready', taskCount: 0 }
    known.set(contentFingerprint, prd)
    imported.push(prd)
  }

  state.prds.unshift(...imported)
  return { imported, duplicates }
}

export function toPublicPrd(prd) {
  const { content, ...publicPrd } = prd
  return publicPrd
}

export function markPrdAllocationStarted(prd, startedAt) {
  Object.assign(prd, {
    analysisStatus: 'analyzing',
    analysisStartedAt: startedAt,
    analysisFinishedAt: '',
    analysisError: '',
    updatedAt: startedAt,
  })
}

export function markPrdAllocationFailed(prd, error, finishedAt) {
  Object.assign(prd, {
    analysisStatus: 'failed',
    analysisFinishedAt: finishedAt,
    analysisError: String(error || '分配失败').slice(0, 240),
    updatedAt: finishedAt,
  })
}

export function recoverInterruptedPrdAllocations(state, recoveredAt) {
  let recovered = 0
  for (const prd of state.prds || []) {
    if (prd.analysisStatus !== 'analyzing') continue
    markPrdAllocationFailed(prd, '分配服务已重启，上一轮分配已中断，请重新分配', recoveredAt)
    recovered += 1
  }
  return recovered
}
