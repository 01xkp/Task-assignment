import { groupPrdsByFeature } from '../shared/feature-modules.js'
import { defaultAllocationProfile, developersByDiscipline, normalizeAllocationProfile } from '../shared/allocation-profile.js'

function selectedPrds(prds, selectedIds) {
  const prdsById = new Map((prds || []).map((prd) => [prd.id, prd]))
  const seen = new Set()
  return (selectedIds || []).flatMap((id) => {
    const normalizedId = String(id || '').trim()
    const prd = prdsById.get(normalizedId)
    if (!prd || seen.has(normalizedId)) return []
    seen.add(normalizedId)
    return [prd]
  })
}

function editableAllocationProfile(value, developers) {
  const fallback = defaultAllocationProfile(developers)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback

  const frontendIds = new Set(developersByDiscipline(developers, 'frontend').map((developer) => developer.id))
  const backendIds = new Set(developersByDiscipline(developers, 'backend').map((developer) => developer.id))
  const frontendDeveloperIds = Array.isArray(value.frontendDeveloperIds)
    ? [...new Set(value.frontendDeveloperIds.map((id) => String(id || '').trim()).filter((id) => frontendIds.has(id)))]
    : fallback.frontendDeveloperIds
  const frontendOwnerId = String(value.frontendOwnerId || '').trim()
  const includeBackend = value.includeBackend === true
  const backendOwnerId = String(value.backendOwnerId || '').trim()

  return {
    frontendDeveloperIds,
    frontendOwnerId: frontendDeveloperIds.includes(frontendOwnerId) ? frontendOwnerId : '',
    includeBackend,
    backendOwnerId: backendIds.has(backendOwnerId) ? backendOwnerId : '',
  }
}

export function selectedFeatureAllocationState(prds, selectedIds, developers, draftProfiles = {}) {
  const groups = groupPrdsByFeature(selectedPrds(prds, selectedIds))
  const profiles = Object.fromEntries(groups.map((group) => {
    const persistedProfile = group.prds.find((prd) => prd.allocationProfile)?.allocationProfile
    const value = Object.hasOwn(draftProfiles, group.featureKey)
      ? draftProfiles[group.featureKey]
      : persistedProfile
    return [group.featureKey, editableAllocationProfile(value, developers)]
  }))
  return { groups, profiles }
}

export function isAllocationProfileComplete(profile, developers) {
  try {
    normalizeAllocationProfile(profile, developers)
    return true
  } catch {
    return false
  }
}
