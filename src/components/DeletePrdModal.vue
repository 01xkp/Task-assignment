<script setup>
import { AlertTriangle, FileText, LoaderCircle, Trash2, X } from 'lucide-vue-next'

defineProps({
  prd: { type: Object, required: true },
  saving: Boolean,
})

const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <div class="modal-backdrop modal-backdrop--top" @mousedown.self="emit('close')">
    <section class="modal-card delete-prd-modal" role="dialog" aria-modal="true" aria-labelledby="delete-prd-title">
      <header class="modal-header compact">
        <div>
          <span class="modal-kicker modal-kicker--danger"><AlertTriangle :size="14" /> DELETE PRD</span>
          <h2 id="delete-prd-title">删除 PRD 文档</h2>
          <p>此操作不可撤销。</p>
        </div>
        <button class="icon-button" title="关闭" :disabled="saving" @click="emit('close')"><X :size="20" /></button>
      </header>

      <div class="modal-body delete-prd-body">
        <FileText :size="24" />
        <div><strong>{{ prd.title }}</strong><span>将移除此 PRD 与模块任务的关联；只有删除功能模块的最后一份来源 PRD，关联任务才会删除。历史调整知识仍会保留。</span></div>
      </div>

      <footer class="modal-footer">
        <span>删除后工作台负载会立即重新计算</span>
        <div>
          <button class="secondary-button" :disabled="saving" @click="emit('close')">取消</button>
          <button class="danger-button" :disabled="saving" @click="emit('confirm')"><LoaderCircle v-if="saving" class="spin" :size="17" /><Trash2 v-else :size="17" />{{ saving ? '正在删除' : '确认删除' }}</button>
        </div>
      </footer>
    </section>
  </div>
</template>
