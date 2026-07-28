<script setup>
import { AlertTriangle, BookOpen, LoaderCircle, Trash2, X } from 'lucide-vue-next'

defineProps({
  entry: { type: Object, required: true },
  saving: Boolean,
})

const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <div class="modal-backdrop modal-backdrop--top" @mousedown.self="!saving && emit('close')">
    <section class="modal-card delete-prd-modal" role="dialog" aria-modal="true" aria-labelledby="delete-knowledge-title">
      <header class="modal-header compact">
        <div>
          <span class="modal-kicker modal-kicker--danger"><AlertTriangle :size="14" /> DELETE KNOWLEDGE</span>
          <h2 id="delete-knowledge-title">删除知识记录</h2>
          <p>此操作不可撤销。</p>
        </div>
        <button class="icon-button" title="关闭" :disabled="saving" @click="emit('close')"><X :size="20" /></button>
      </header>

      <div class="modal-body delete-prd-body">
        <BookOpen :size="24" />
        <div>
          <strong>{{ entry.taskTitle }}</strong>
          <span>{{ entry.reason }}<template v-if="entry.note">；备注：{{ entry.note }}</template></span>
        </div>
      </div>

      <footer class="modal-footer">
        <span>删除后，未来 AI 分析将不再检索此记录，已有任务不受影响</span>
        <div>
          <button class="secondary-button" :disabled="saving" @click="emit('close')">取消</button>
          <button class="danger-button" :disabled="saving" @click="emit('confirm')"><LoaderCircle v-if="saving" class="spin" :size="17" /><Trash2 v-else :size="17" />{{ saving ? '正在删除' : '确认删除' }}</button>
        </div>
      </footer>
    </section>
  </div>
</template>
