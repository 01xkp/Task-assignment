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
