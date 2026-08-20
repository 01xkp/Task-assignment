export function modelLifecycleProgress(eventType) {
  if (eventType === 'response.created' || eventType === 'response.in_progress') {
    return { accepted: true, waitingForOutput: true }
  }
  return null
}

export function mergeAnalysisProgress(lastProgress = {}, progress = {}) {
  return { ...lastProgress, ...progress, heartbeat: progress.heartbeat === true }
}
