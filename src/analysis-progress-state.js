export function progressDetail(progress = {}) {
  if (!progress.waitingForOutput) return progress.message || '正在连接模型服务'
  return progress.heartbeat
    ? '模型仍在推理，连接保持中；尚未返回任务正文'
    : `${progress.message || '模型已接受请求，正在推理'}；尚未返回任务正文`
}
