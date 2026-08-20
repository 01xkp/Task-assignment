<script setup>
import { computed } from 'vue'
import { BrainCircuit, Timer } from 'lucide-vue-next'
import { progressDetail } from '../analysis-progress-state.js'

const props = defineProps({
  progress: { type: Object, default: () => ({}) },
  elapsedSeconds: { type: Number, default: 0 },
  title: { type: String, default: 'AI 正在分析 PRD' },
})

const percent = computed(() => Math.max(0, Math.min(100, Number(props.progress.percent || 0))))
const elapsedLabel = computed(() => {
  const minutes = Math.floor(props.elapsedSeconds / 60)
  const seconds = props.elapsedSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
</script>

<template>
  <div class="analysis-progress-card" role="status" aria-live="polite">
    <div class="analysis-progress-heading">
      <span class="analysis-progress-icon"><BrainCircuit :size="18" /></span>
      <div>
        <strong>{{ title }}</strong>
        <small>{{ progress.model || '正在准备模型' }}{{ progress.reasoningEffort ? ` · ${progress.reasoningEffort}` : '' }}</small>
      </div>
      <span class="analysis-progress-time"><Timer :size="14" />{{ elapsedLabel }}</span>
    </div>
    <div class="analysis-progress-track" aria-hidden="true">
      <span :style="{ width: `${percent}%` }"></span>
    </div>
    <div class="analysis-progress-detail">
      <span>{{ progressDetail(progress) }}</span>
      <strong>{{ percent }}%</strong>
    </div>
  </div>
</template>
