function normalizedPath(value) {
  return String(value || '').normalize('NFC').replaceAll('\\', '/').trim()
}

function sourceFolder(prd) {
  if (prd?.sourceType !== 'file') return ''
  const source = normalizedPath(prd.sourceLabel)
  const relativePath = source.includes('!/') ? source.slice(source.indexOf('!/') + 2) : source
  const parts = relativePath.split('/').filter(Boolean)
  return parts.length > 1 ? parts[0] : ''
}

function featureDisplayName(folder) {
  return folder.replace(/[-_ ]v\d+(?:\.\d+)*$/i, '').trim() || folder
}

export function featureForPrd(prd) {
  const folder = sourceFolder(prd)
  if (folder) return { featureKey: `folder:${folder}`, featureName: featureDisplayName(folder) }
  const id = String(prd?.id || '').trim()
  return { featureKey: `prd:${id}`, featureName: String(prd?.title || '未命名需求').trim() || '未命名需求' }
}

export function applyFeatureIdentity(prd) {
  if (prd?.featureKey && prd?.featureName) return prd
  return { ...prd, ...featureForPrd(prd) }
}

export function groupPrdsByFeature(prds) {
  const groups = new Map()

  for (const sourcePrd of Array.isArray(prds) ? prds : []) {
    const prd = applyFeatureIdentity(sourcePrd)
    let group = groups.get(prd.featureKey)
    if (!group) {
      group = { featureKey: prd.featureKey, featureName: prd.featureName, prds: [], prdIds: [] }
      groups.set(group.featureKey, group)
    }
    group.prds.push(prd)
    group.prdIds.push(prd.id)
  }

  return [...groups.values()]
}

export function mergeFeaturePrds(group) {
  const prds = Array.isArray(group?.prds) ? group.prds : []
  return {
    id: group?.prdIds?.[0] || prds[0]?.id || '',
    title: group?.featureName || prds[0]?.title || '未命名需求',
    sourceType: 'feature',
    sourceLabel: group?.featureName || prds[0]?.sourceLabel || '',
    featureKey: group?.featureKey || '',
    featureName: group?.featureName || '',
    content: prds.map((prd) => [
      `来源文档：${prd.sourceLabel || prd.title || '未命名文档'}`,
      `文档标题：${prd.title || '未命名文档'}`,
      '',
      String(prd.content || '').trim(),
    ].join('\n')).join('\n\n'),
  }
}
