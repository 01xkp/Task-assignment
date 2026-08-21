<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Bot, CheckCircle2, FileArchive, FileText, FolderOpen, Link2, LoaderCircle, Server, Sparkles, Type, UploadCloud, UsersRound, X } from 'lucide-vue-next'
import { api } from '../api.js'
import { addSelectedFiles, folderMarkdownFiles, relativeFilePath, selectedFileKey } from '../import-file-selection.js'
import { isImportResultScreen, shouldShowFeatureAllocation } from '../import-modal-state.js'
import { allocationStatusPresentation } from '../prd-allocation-status.js'
import { isAllocationProfileComplete, selectedFeatureAllocationState } from '../feature-allocation-state.js'
import AnalysisProgress from './AnalysisProgress.vue'

const props = defineProps({
  model: Object,
  workspace: { type: Object, required: true },
  initialMode: { type: String, default: 'file' },
})
const emit = defineEmits(['close', 'imported', 'batch-analyzed', 'error'])

const mode = ref(props.initialMode)
const files = ref([])
const archive = ref(null)
const folderInput = ref(null)
const archiveInput = ref(null)
const url = ref('')
const title = ref('')
const content = ref('')
const importResult = ref(null)
const selectedPrdIds = ref([])
const allocationProfiles = ref({})
const busy = ref(false)
const analyzing = ref(false)
const dragging = ref(false)
const useReview = ref(true)
const analysisProgress = ref(null)
const batchProgress = ref({ total: 0, current: 0, currentTitle: '', outcomes: [] })
const batchSummary = ref(null)
const elapsedSeconds = ref(0)
let elapsedTimer = null
const supportsFolderImport = 'webkitdirectory' in document.createElement('input')

const modes = [
  { id: 'file', label: '本地文档', icon: FileText },
  { id: 'library', label: '已上传 PRD', icon: FileText },
  { id: 'url', label: '在线地址', icon: Link2 },
  { id: 'text', label: '粘贴正文', icon: Type },
]

const canImport = computed(() => {
  if (mode.value === 'file') return files.value.length > 0 || Boolean(archive.value)
  if (mode.value === 'url') return /^https?:\/\//.test(url.value)
  if (mode.value === 'text') return content.value.trim().length >= 20
  return false
})
const allocationState = computed(() => selectedFeatureAllocationState(
  props.workspace.prds,
  selectedPrdIds.value,
  props.workspace.developers,
  allocationProfiles.value,
))
const selectedFeatureGroups = computed(() => allocationState.value.groups)
const frontendDevelopers = computed(() => (props.workspace.developers || []).filter((developer) => developer.discipline !== 'backend'))
const backendDevelopers = computed(() => (props.workspace.developers || []).filter((developer) => developer.discipline === 'backend'))
const canAnalyze = computed(() => selectedPrdIds.value.length > 0
  && Boolean(props.model?.configured)
  && selectedFeatureGroups.value.every((group) => isAllocationProfileComplete(allocationProfiles.value[group.featureKey], props.workspace.developers)))
const resultItems = computed(() => importResult.value?.imported || [])
const resultScreen = computed(() => isImportResultScreen(importResult.value, batchSummary.value, { mode: mode.value, analyzing: analyzing.value }))
const showFeatureAllocation = computed(() => shouldShowFeatureAllocation(mode.value, importResult.value, { resultScreen: resultScreen.value }))

watch(() => props.initialMode, (value) => {
  if (!busy.value && !analyzing.value) mode.value = value
})

watch([selectedPrdIds, () => props.workspace.prds], () => {
  const next = selectedFeatureAllocationState(
    props.workspace.prds,
    selectedPrdIds.value,
    props.workspace.developers,
    allocationProfiles.value,
  )
  allocationProfiles.value = next.profiles
}, { deep: true, immediate: true })

function startElapsedTimer() {
  elapsedSeconds.value = 0
  window.clearInterval(elapsedTimer)
  elapsedTimer = window.setInterval(() => { elapsedSeconds.value += 1 }, 1000)
}

function stopElapsedTimer() {
  window.clearInterval(elapsedTimer)
  elapsedTimer = null
}

function fileKey(file) {
  return selectedFileKey(file)
}

function addFiles(nextFiles) {
  files.value = addSelectedFiles(files.value, nextFiles)
}

function selectFiles(event) {
  addFiles(event.target.files || [])
  event.target.value = ''
}

function onDrop(event) {
  dragging.value = false
  addFiles(event.dataTransfer.files || [])
}

function chooseFolder() {
  folderInput.value?.click()
}

function selectFolder(event) {
  addFiles(folderMarkdownFiles(event.target.files || []))
  event.target.value = ''
}

function chooseArchive() {
  archiveInput.value?.click()
}

function selectArchive(event) {
  archive.value = Array.from(event.target.files || [])[0] || null
  event.target.value = ''
}

function removeFile(file) {
  files.value = files.value.filter((item) => fileKey(item) !== fileKey(file))
}

function removeArchive() {
  archive.value = null
}

function setMode(nextMode) {
  if (busy.value || analyzing.value) return
  mode.value = nextMode
  importResult.value = null
  batchSummary.value = null
  selectedPrdIds.value = []
  allocationProfiles.value = {}
}

function requestClose() {
  if (!analyzing.value) emit('close')
}

function resetImport() {
  if (analyzing.value) return
  importResult.value = null
  batchSummary.value = null
  selectedPrdIds.value = []
  allocationProfiles.value = {}
  files.value = []
  archive.value = null
}

function togglePrd(prdId) {
  const next = new Set(selectedPrdIds.value)
  next.has(prdId) ? next.delete(prdId) : next.add(prdId)
  selectedPrdIds.value = [...next]
}

function toggleAllLibrary() {
  const allIds = props.workspace.prds.map((prd) => prd.id)
  selectedPrdIds.value = selectedPrdIds.value.length === allIds.length ? [] : allIds
}

function allocationProfileError(featureKey) {
  const profile = allocationProfiles.value[featureKey]
  if (!profile?.frontendDeveloperIds?.length) return '请至少选择一位前端开发人员'
  if (profile.includeBackend && !profile.backendOwnerId) return '启用后端任务后请选择后端负责人'
  return isAllocationProfileComplete(profile, props.workspace.developers) ? '' : '人员选择无效，请重新选择'
}

async function importPrd() {
  if (!canImport.value || busy.value) return
  busy.value = true
  try {
    let result
    if (mode.value === 'file') result = await api.uploadPrds(files.value, archive.value)
    else if (mode.value === 'url') result = { imported: [await api.importUrl(url.value)], duplicates: [], failed: [] }
    else result = { imported: [await api.importText(title.value, content.value)], duplicates: [], failed: [] }
    importResult.value = result
    selectedPrdIds.value = result.imported.map((prd) => prd.id)
    emit('imported', result)
  } catch (error) {
    emit('error', error.message)
  } finally {
    busy.value = false
  }
}

async function analyzeSelected() {
  if (analyzing.value || !canAnalyze.value) return
  analyzing.value = true
  batchSummary.value = null
  batchProgress.value = { total: selectedFeatureGroups.value.length, current: 0, currentTitle: '', outcomes: [] }
  analysisProgress.value = { stage: 'connecting', percent: 1, message: '正在准备批量分析队列', model: props.model?.model, reasoningEffort: props.model?.reasoningEffort }
  startElapsedTimer()
  try {
    const summary = await api.analyzePrds(selectedPrdIds.value, {
      review: useReview.value,
      allocationProfiles: allocationProfiles.value,
      onEvent: ({ event, payload }) => {
        if (event === 'batch-item-start') {
          batchProgress.value = { ...batchProgress.value, current: payload.index + 1, total: payload.total, currentTitle: payload.title }
          analysisProgress.value = { ...analysisProgress.value, percent: Math.round(payload.index / payload.total * 100), message: `正在分析第 ${payload.index + 1} / ${payload.total} 份：${payload.title}` }
        }
        if (event === 'batch-progress') {
          const stagePercent = Number(payload.progress?.percent || 0)
          analysisProgress.value = {
            ...payload.progress,
            percent: Math.round((payload.index + stagePercent / 100) / payload.total * 100),
            message: `${payload.title}：${payload.progress?.message || '正在分析'}`,
          }
        }
        if (event === 'batch-item-result' || event === 'batch-item-error') {
          batchProgress.value.outcomes.push({ event, ...payload })
          analysisProgress.value = { ...analysisProgress.value, percent: Math.round((payload.index + 1) / payload.total * 100) }
        }
      },
    })
    batchSummary.value = summary
    analysisProgress.value = { ...analysisProgress.value, percent: 100, message: '批量分析已完成' }
    emit('batch-analyzed', summary)
  } catch (error) {
    emit('error', error.message)
  } finally {
    analyzing.value = false
    stopElapsedTimer()
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
          <h2 id="import-title">{{ batchSummary ? '批量分析完成' : importResult ? '文档导入结果' : mode === 'library' ? '选择已上传 PRD' : '导入产品需求文档' }}</h2>
          <p>{{ batchSummary ? '可关闭窗口并在工作台查看按功能模块分组的任务。' : importResult ? '重复正文已跳过，成功导入的文档可以加入分析队列。' : mode === 'library' ? '多选已上传文档，按功能模块设置人员后依次分析。' : '支持本地文件、文件夹、ZIP、在线文档和直接粘贴正文。' }}</p>
        </div>
        <button class="icon-button" title="关闭" :disabled="analyzing" @click="requestClose"><X :size="20" /></button>
      </header>

      <template v-if="!resultScreen">
        <div class="import-tabs">
          <button v-for="item in modes" :key="item.id" :class="{ active: mode === item.id }" :disabled="analyzing" @click="setMode(item.id)">
            <component :is="item.icon" :size="17" />{{ item.label }}
          </button>
        </div>

        <div class="modal-body import-body" :class="{ 'import-body--library': mode === 'library' }">
          <template v-if="mode === 'file'">
            <label
              class="drop-zone"
              :class="{ 'drop-zone--active': dragging, 'drop-zone--selected': files.length || archive }"
              @dragover.prevent="dragging = true"
              @dragleave.prevent="dragging = false"
              @drop.prevent="onDrop"
            >
              <input type="file" multiple accept=".pdf,.docx,.md,.txt,.json" @change="selectFiles" />
              <div class="drop-icon"><FileText v-if="files.length || archive" :size="27" /><UploadCloud v-else :size="27" /></div>
              <strong>{{ files.length ? `已选择 ${files.length} 份 PRD` : archive ? `已选择 ZIP：${archive.name}` : '选择 PRD 文档' }}</strong>
              <span>PDF、DOCX、Markdown 或纯文本，单文件最大 10MB</span>
            </label>
            <input v-if="supportsFolderImport" ref="folderInput" class="import-source-input" type="file" multiple webkitdirectory accept=".md,text/markdown" @change="selectFolder" />
            <input ref="archiveInput" class="import-source-input" type="file" accept=".zip,application/zip" @change="selectArchive" />
            <div class="import-source-actions">
              <button v-if="supportsFolderImport" type="button" class="secondary-button" @click="chooseFolder"><FolderOpen :size="16" />选择文件夹</button>
              <button type="button" class="secondary-button" @click="chooseArchive"><FileArchive :size="16" />导入 ZIP</button>
            </div>
            <div v-if="files.length || archive" class="selected-file-list" aria-label="已选择文件">
              <div v-for="file in files" :key="fileKey(file)" class="selected-file-row"><FileText :size="16" /><span :title="relativeFilePath(file)">{{ relativeFilePath(file) }}</span><small>{{ (file.size / 1024).toFixed(1) }} KB</small><button class="icon-button" title="移除文件" @click.prevent="removeFile(file)"><X :size="15" /></button></div>
              <div v-if="archive" class="selected-file-row selected-file-row--archive"><FileArchive :size="16" /><span :title="archive.name">{{ archive.name }}</span><small>{{ (archive.size / 1024).toFixed(1) }} KB</small><button class="icon-button" title="移除 ZIP" @click.prevent="removeArchive"><X :size="15" /></button></div>
            </div>
          </template>

          <div v-else-if="mode === 'library'" class="prd-selection-list">
            <div class="selection-list-head"><span>{{ workspace.prds.length }} 份可选文档</span><button class="text-action" :disabled="analyzing || !workspace.prds.length" @click="toggleAllLibrary">{{ selectedPrdIds.length === workspace.prds.length && workspace.prds.length ? '取消全选' : '全选' }}</button></div>
            <label v-for="prd in workspace.prds" :key="prd.id" class="prd-selection-row">
              <input type="checkbox" :checked="selectedPrdIds.includes(prd.id)" :disabled="analyzing" @change="togglePrd(prd.id)" />
              <FileText :size="18" />
              <span><strong>{{ prd.title }}</strong><small>{{ prd.sourceLabel }} · {{ prd.taskCount || 0 }} 个任务 · <span class="analysis-state" :class="allocationStatusPresentation(prd.analysisStatus).tone">{{ allocationStatusPresentation(prd.analysisStatus).label }}</span></small></span>
            </label>
            <div v-if="!workspace.prds.length" class="selection-empty">暂无已上传 PRD，请先导入文档。</div>
          </div>

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

      </template>

      <template v-else>
        <div class="modal-body imported-body">
          <template v-if="importResult">
            <div class="import-success"><div class="success-icon"><CheckCircle2 :size="28" /></div><div><span>导入处理完成</span><h3>成功 {{ resultItems.length }} 份 · 跳过 {{ importResult.duplicates.length }} 份</h3><p>{{ importResult.failed.length ? `${importResult.failed.length} 份文件读取失败` : '重复正文不会再次进入需求库。' }}</p></div></div>
            <div class="import-result-list">
              <div v-for="prd in resultItems" :key="prd.id" class="import-result-row"><input type="checkbox" :checked="selectedPrdIds.includes(prd.id)" :disabled="analyzing" @change="togglePrd(prd.id)" /><CheckCircle2 :size="17" /><span><strong>{{ prd.title }}</strong><small>{{ prd.sourceLabel }}</small></span></div>
              <div v-for="duplicate in importResult.duplicates" :key="`${duplicate.sourceLabel}:${duplicate.existingPrdId}`" class="import-result-row result-tone--duplicate"><span></span><FileText :size="17" /><span><strong>{{ duplicate.sourceLabel }}</strong><small>正文重复，已保留「{{ duplicate.existingTitle }}」</small></span></div>
              <div v-for="failed in importResult.failed" :key="`${failed.sourceLabel}:${failed.error}`" class="import-result-row result-tone--error"><span></span><X :size="17" /><span><strong>{{ failed.sourceLabel }}</strong><small>{{ failed.error }}</small></span></div>
            </div>
          </template>
          <div v-else-if="batchSummary" class="import-success"><div class="success-icon"><CheckCircle2 :size="28" /></div><div><span>批量分析完成</span><h3>成功 {{ batchSummary.succeeded.length }} 份 · 失败 {{ batchSummary.failed.length }} 份</h3><p>任务已按 PRD 和任务类别更新到工作台。</p></div></div>
          <div v-else class="import-success"><div class="success-icon"><LoaderCircle class="spin" :size="28" /></div><div><span>正在批量分析</span><h3>第 {{ batchProgress.current }} / {{ batchProgress.total }} 份 PRD</h3><p>{{ batchProgress.currentTitle || '正在准备分析队列。' }}</p></div></div>
          <AnalysisProgress v-if="analyzing || batchSummary" :progress="analysisProgress" :elapsed-seconds="elapsedSeconds" title="正在批量生成开发任务" />
          <div v-if="batchSummary" class="batch-progress-summary"><strong>分析完成：{{ batchSummary.succeeded.length }} 份成功，{{ batchSummary.failed.length }} 份失败</strong><span v-for="outcome in batchProgress.outcomes" :key="`${outcome.event}:${outcome.prdId}`" :class="{ failed: outcome.event === 'batch-item-error' }">{{ outcome.title || outcome.prdId }} · {{ outcome.event === 'batch-item-error' ? outcome.error : `已生成 ${outcome.result.tasks.length} 个任务` }}</span></div>
          <div v-if="!model?.configured" class="config-warning"><span></span><div><strong>模型密钥尚未配置</strong><p>在项目根目录创建 .env.local 并设置 OPENAI_API_KEY 后即可分析。</p></div></div>
        </div>
      </template>

      <div v-if="showFeatureAllocation" class="modal-body analysis-options">
        <div v-if="selectedFeatureGroups.length" class="feature-allocation-list">
          <section v-for="group in selectedFeatureGroups" :key="group.featureKey" class="feature-allocation-editor">
            <header class="feature-allocation-editor__header"><div><strong>{{ group.featureName }}</strong><small>{{ group.prds.length }} 份来源文档</small></div><span>{{ group.featureKey.startsWith('folder:') ? '合并功能' : '独立功能' }}</span></header>
            <fieldset class="feature-allocation-editor__field">
              <legend><UsersRound :size="15" />可用前端人员</legend>
              <div class="feature-allocation-editor__members">
                <label v-for="developer in frontendDevelopers" :key="developer.id"><input v-model="allocationProfiles[group.featureKey].frontendDeveloperIds" type="checkbox" :value="developer.id" :disabled="analyzing" /><span class="avatar" :style="{ background: developer.color }">{{ developer.initials }}</span><span>{{ developer.name }}</span></label>
              </div>
            </fieldset>
            <label class="switch-row feature-allocation-editor__switch"><div><Server :size="18" /><span><strong>包含后端任务</strong><small>该功能的服务端任务由一位后端人员主责</small></span></div><input v-model="allocationProfiles[group.featureKey].includeBackend" type="checkbox" :disabled="analyzing" /><span class="switch-control"></span></label>
            <label v-if="allocationProfiles[group.featureKey].includeBackend" class="feature-allocation-editor__backend"><span>后端负责人</span><select v-model="allocationProfiles[group.featureKey].backendOwnerId" :disabled="analyzing"><option value="">请选择</option><option v-for="developer in backendDevelopers" :key="developer.id" :value="developer.id">{{ developer.name }} · {{ developer.role }}</option></select></label>
            <p v-if="allocationProfileError(group.featureKey)" class="feature-allocation-editor__error">{{ allocationProfileError(group.featureKey) }}</p>
          </section>
        </div>
        <label class="switch-row">
          <div><Bot :size="18" /><span><strong>启用方案复核</strong><small>检查任务遗漏、负载与依赖闭环</small></span></div>
          <input v-model="useReview" type="checkbox" :disabled="analyzing" /><span class="switch-control"></span>
        </label>
        <div v-if="!model?.configured" class="config-warning"><span></span><div><strong>模型密钥尚未配置</strong><p>在项目根目录创建 .env.local 并设置 OPENAI_API_KEY 后即可分析。</p></div></div>
      </div>

      <footer class="modal-footer">
        <template v-if="!resultScreen">
          <span>{{ mode === 'library' ? `已选择 ${selectedPrdIds.length} 份 PRD · ${selectedFeatureGroups.length} 个功能` : '文档只保存在本地知识目录' }}</span>
          <div><button class="secondary-button" @click="requestClose">取消</button><button v-if="mode === 'library'" class="primary-button" :disabled="!canAnalyze || analyzing" @click="analyzeSelected"><LoaderCircle v-if="analyzing" class="spin" :size="17" /><Sparkles v-else :size="17" />开始分析</button><button v-else class="primary-button" :disabled="!canImport || busy" @click="importPrd"><LoaderCircle v-if="busy" class="spin" :size="17" /><UploadCloud v-else :size="17" />{{ busy ? '正在读取' : '导入文档' }}</button></div>
        </template>
        <template v-else>
          <button class="text-action" :disabled="analyzing" @click="resetImport">{{ importResult ? '重新导入' : '重新选择' }}</button>
          <div><button class="secondary-button" :disabled="analyzing" @click="requestClose">关闭</button><button v-if="importResult && !batchSummary" class="primary-button" :disabled="!canAnalyze || analyzing" @click="analyzeSelected"><LoaderCircle v-if="analyzing" class="spin" :size="17" /><Sparkles v-else :size="17" />{{ analyzing ? `${analysisProgress?.percent || 0}% 分析中` : `分析 ${selectedPrdIds.length} 份 PRD` }}</button></div>
        </template>
      </footer>
    </section>
  </div>
</template>
