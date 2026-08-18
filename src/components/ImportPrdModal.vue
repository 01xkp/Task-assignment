<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { Bot, CheckCircle2, FileText, Link2, LoaderCircle, Sparkles, Type, UploadCloud, X } from 'lucide-vue-next'
import { api } from '../api.js'
import AnalysisProgress from './AnalysisProgress.vue'

const props = defineProps({ model: Object })
const emit = defineEmits(['close', 'imported', 'analyzed', 'error'])

const mode = ref('file')
const file = ref(null)
const url = ref('')
const title = ref('')
const content = ref('')
const importedPrd = ref(null)
const busy = ref(false)
const analyzing = ref(false)
const dragging = ref(false)
const useReview = ref(true)
const analysisProgress = ref(null)
const elapsedSeconds = ref(0)
let elapsedTimer = null

const modes = [
  { id: 'file', label: '本地文档', icon: FileText },
  { id: 'url', label: '在线地址', icon: Link2 },
  { id: 'text', label: '粘贴正文', icon: Type },
]

const canImport = computed(() => {
  if (mode.value === 'file') return Boolean(file.value)
  if (mode.value === 'url') return /^https?:\/\//.test(url.value)
  return content.value.trim().length >= 20
})

function startElapsedTimer() {
  elapsedSeconds.value = 0
  window.clearInterval(elapsedTimer)
  elapsedTimer = window.setInterval(() => { elapsedSeconds.value += 1 }, 1000)
}

function stopElapsedTimer() {
  window.clearInterval(elapsedTimer)
  elapsedTimer = null
}

function requestClose() {
  if (analyzing.value) return
  emit('close')
}

function resetImportedPrd() {
  if (analyzing.value) return
  importedPrd.value = null
}

function selectFile(event) {
  const selected = event.target.files?.[0]
  if (selected) file.value = selected
}

function onDrop(event) {
  dragging.value = false
  const selected = event.dataTransfer.files?.[0]
  if (selected) file.value = selected
}

async function importPrd() {
  if (!canImport.value || busy.value) return
  busy.value = true
  try {
    let result
    if (mode.value === 'file') result = await api.uploadPrd(file.value)
    else if (mode.value === 'url') result = await api.importUrl(url.value)
    else result = await api.importText(title.value, content.value)
    importedPrd.value = result
    emit('imported', result)
  } catch (error) {
    emit('error', error.message)
  } finally {
    busy.value = false
  }
}

async function analyze() {
  if (analyzing.value || !importedPrd.value) return
  if (!props.model?.configured) {
    emit('error', '请先在 .env.local 中配置 OPENAI_API_KEY')
    return
  }
  analyzing.value = true
  analysisProgress.value = { stage: 'connecting', percent: 2, message: '正在连接模型服务', model: props.model?.model, reasoningEffort: props.model?.reasoningEffort }
  startElapsedTimer()
  try {
    const result = await api.analyzePrd(importedPrd.value.id, useReview.value, {
      onProgress: (progress) => { analysisProgress.value = progress },
    })
    emit('analyzed', result)
  } catch (error) {
    analyzing.value = false
    stopElapsedTimer()
    emit('error', error.message)
  }
}

onBeforeUnmount(stopElapsedTimer)
</script>

<template>
  <div class="modal-backdrop" @mousedown.self="requestClose">
    <section class="modal-card import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" :aria-busy="analyzing">
      <header class="modal-header">
        <div>
          <span class="modal-kicker"><Sparkles :size="14" /> PRD ANALYSIS</span>
          <h2 id="import-title">{{ importedPrd ? '文档已准备完成' : '导入产品需求文档' }}</h2>
          <p>{{ importedPrd ? '确认分析配置并生成开发任务。' : '支持本地文件、在线文档和直接粘贴正文。' }}</p>
        </div>
        <button class="icon-button" title="关闭" :disabled="analyzing" @click="requestClose"><X :size="20" /></button>
      </header>

      <template v-if="!importedPrd">
        <div class="import-tabs">
          <button v-for="item in modes" :key="item.id" :class="{ active: mode === item.id }" @click="mode = item.id">
            <component :is="item.icon" :size="17" />{{ item.label }}
          </button>
        </div>

        <div class="modal-body import-body">
          <label
            v-if="mode === 'file'"
            class="drop-zone"
            :class="{ 'drop-zone--active': dragging, 'drop-zone--selected': file }"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
          >
            <input type="file" accept=".pdf,.docx,.md,.txt,.json" @change="selectFile" />
            <div class="drop-icon"><FileText v-if="file" :size="27" /><UploadCloud v-else :size="27" /></div>
            <strong>{{ file ? file.name : '选择 PRD 文档' }}</strong>
            <span>{{ file ? `${(file.size / 1024).toFixed(1)} KB · 点击更换` : 'PDF、DOCX、Markdown 或纯文本，最大 10MB' }}</span>
          </label>

          <div v-else-if="mode === 'url'" class="form-stack">
            <label class="field-label">在线文档地址</label>
            <div class="url-input"><Link2 :size="18" /><input v-model="url" type="url" placeholder="https://docs.example.com/product-v2" autofocus /></div>
            <div class="field-note">网页正文、PDF 与 DOCX 直链会在本地服务端读取。</div>
          </div>

          <div v-else class="form-stack">
            <label class="field-label">需求标题</label>
            <input v-model="title" class="text-input" placeholder="例如：结算中心 v2.1" />
            <label class="field-label field-label--spaced">PRD 正文</label>
            <textarea v-model="content" class="text-area prd-textarea" placeholder="粘贴目标、范围、业务规则与验收要求…"></textarea>
            <div class="char-count">{{ content.length }} 字</div>
          </div>
        </div>

        <footer class="modal-footer">
          <span>文档只保存在本地知识目录</span>
          <div><button class="secondary-button" @click="requestClose">取消</button><button class="primary-button" :disabled="!canImport || busy" @click="importPrd"><LoaderCircle v-if="busy" class="spin" :size="17" /><UploadCloud v-else :size="17" />{{ busy ? '正在读取' : '导入文档' }}</button></div>
        </footer>
      </template>

      <template v-else>
        <div class="modal-body imported-body">
          <div class="import-success">
            <div class="success-icon"><CheckCircle2 :size="28" /></div>
            <div><span>文档读取成功</span><h3>{{ importedPrd.title }}</h3><p>{{ importedPrd.sourceLabel }}</p></div>
          </div>

          <div class="analysis-pipeline">
            <div class="pipeline-node active"><span>1</span><div><strong>需求拆解</strong><small>{{ model?.model }}</small></div></div>
            <div class="pipeline-line"></div>
            <div class="pipeline-node" :class="{ active: useReview }"><span>2</span><div><strong>方案复核</strong><small>{{ useReview ? model?.model : '已关闭' }}</small></div></div>
            <div class="pipeline-line"></div>
            <div class="pipeline-node active"><span>3</span><div><strong>知识沉淀</strong><small>本地知识库</small></div></div>
          </div>

          <label class="switch-row">
            <div><Bot :size="18" /><span><strong>启用方案复核</strong><small>检查任务遗漏、负载与依赖闭环</small></span></div>
            <input v-model="useReview" type="checkbox" :disabled="analyzing" /><span class="switch-control"></span>
          </label>

          <AnalysisProgress
            v-if="analyzing"
            :progress="analysisProgress"
            :elapsed-seconds="elapsedSeconds"
            title="正在生成开发任务"
          />

          <div v-if="!model?.configured" class="config-warning">
            <span></span><div><strong>模型密钥尚未配置</strong><p>在项目根目录创建 .env.local 并设置 OPENAI_API_KEY 后即可分析。</p></div>
          </div>
        </div>

        <footer class="modal-footer">
          <button class="text-action" :disabled="analyzing" @click="resetImportedPrd">重新选择</button>
          <div><button class="secondary-button" :disabled="analyzing" @click="requestClose">稍后分析</button><button class="primary-button" :disabled="analyzing || !model?.configured" @click="analyze"><LoaderCircle v-if="analyzing" class="spin" :size="17" /><Sparkles v-else :size="17" />{{ analyzing ? `${analysisProgress?.percent || 0}% 分析中` : '生成任务分配' }}</button></div>
        </footer>
      </template>
    </section>
  </div>
</template>
