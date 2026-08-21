<script setup>
import { computed, ref } from 'vue'
import { Bot, Check, LoaderCircle, RefreshCw, Sparkles, X } from 'lucide-vue-next'
import { api } from '../api.js'
import { eligibleDevelopersForTask } from '../../shared/allocation-profile.js'

const props = defineProps({
  task: { type: Object, required: true },
  developers: { type: Array, required: true },
  modelConfigured: Boolean,
})
const emit = defineEmits(['close', 'saved', 'error'])

const reason = ref('')
const note = ref('')
const assignee = ref('')
const saving = ref(false)
const suggesting = ref(false)
const suggestion = ref(null)

const candidates = computed(() => eligibleDevelopersForTask(props.task, props.developers)
  .filter((item) => item.name !== props.task.assignee))
const canSave = computed(() => assignee.value && reason.value.trim().length >= 4 && note.value.trim().length >= 2)
const reasonOptions = ['平衡团队当前负载', '调整后更符合技能方向', '减少跨模块沟通成本', '接续已有模块上下文']

async function askModel() {
  if (!props.modelConfigured) {
    emit('error', '请先配置 OPENAI_API_KEY 后使用 AI 建议')
    return
  }
  suggesting.value = true
  try {
    suggestion.value = await api.suggestReassignment(props.task.id)
    assignee.value = suggestion.value.assignee
    reason.value = '模型建议重新分配'
    note.value = suggestion.value.reasoning
  } catch (error) {
    emit('error', error.message)
  } finally {
    suggesting.value = false
  }
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    await api.reassignTask(props.task.id, assignee.value, reason.value, note.value, suggestion.value ? 'ai' : 'human')
    emit('saved', `任务已重新分配给${assignee.value}，备注已保存`)
  } catch (error) {
    emit('error', error.message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="modal-backdrop modal-backdrop--top" @mousedown.self="emit('close')">
    <section class="modal-card adjustment-modal" role="dialog" aria-modal="true">
      <header class="modal-header compact">
        <div class="adjustment-title">
          <div class="adjust-icon--reassign"><RefreshCw :size="21" /></div>
          <div><h2>重新分配任务</h2><p>{{ task.title }}</p></div>
        </div>
        <button class="icon-button" title="关闭" @click="emit('close')"><X :size="20" /></button>
      </header>

      <div class="modal-body adjustment-body">
        <div class="assignment-from"><span>当前负责人</span><strong><i class="avatar" :style="{ background: developers.find((item) => item.name === task.assignee)?.color }">{{ task.assignee.slice(0, 1) }}</i>{{ task.assignee }}</strong></div>
        <label class="field-label">调整给</label>
        <div class="candidate-grid">
          <button v-for="person in candidates" :key="person.id" :class="{ selected: assignee === person.name }" @click="assignee = person.name">
            <span class="avatar" :style="{ background: person.color }">{{ person.initials }}</span>
            <span><strong>{{ person.name }}</strong><small>{{ person.role }}</small></span>
            <i><Check :size="13" /></i>
          </button>
        </div>
        <button class="ai-suggest-button" :disabled="suggesting || !modelConfigured" @click="askModel">
          <Sparkles :size="17" />
          <span><strong>{{ suggesting ? '正在分析团队负载与历史原因' : '使用模型推荐负责人' }}</strong><small>{{ modelConfigured ? '结合技能、工时和本地知识库' : '模型密钥未配置' }}</small></span>
          <LoaderCircle v-if="suggesting" class="spin" :size="18" /><Bot v-else :size="18" />
        </button>

        <label class="field-label field-label--spaced">重新分配原因 <span>将写入本地知识库</span></label>
        <div class="reason-chips"><button v-for="option in reasonOptions" :key="option" :class="{ active: reason === option }" @click="reason = option">{{ option }}</button></div>
        <textarea v-model="reason" class="text-area reason-textarea reason-textarea--compact" placeholder="说明此次重新分配的主要原因…"></textarea>
        <label class="field-label field-label--spaced">重新分配备注 <span>记录交接事项与执行提醒</span></label>
        <textarea v-model="note" class="text-area reason-textarea" placeholder="填写需要保留的背景、交接内容或后续注意事项…"></textarea>
        <div class="reason-footer"><span>原因 {{ reason.length }} 字 · 备注 {{ note.length }} 字</span><span v-if="suggestion" class="ai-filled"><Sparkles :size="13" />AI 建议已填入备注</span></div>
      </div>

      <footer class="modal-footer">
        <span>保存后将影响下一次模型分配</span>
        <div><button class="secondary-button" @click="emit('close')">取消</button><button class="primary-button" :disabled="!canSave || saving" @click="save"><LoaderCircle v-if="saving" class="spin" :size="17" /><RefreshCw v-else :size="17" />{{ saving ? '正在保存' : '确认重分配' }}</button></div>
      </footer>
    </section>
  </div>
</template>
