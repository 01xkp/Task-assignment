<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  AlertCircle,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleGauge,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Users,
  X,
} from 'lucide-vue-next'
import { api } from './api.js'
import WorkbenchView from './components/WorkbenchView.vue'
import PrdView from './components/PrdView.vue'
import KnowledgeView from './components/KnowledgeView.vue'
import ImportPrdModal from './components/ImportPrdModal.vue'
import TaskDrawer from './components/TaskDrawer.vue'
import AdjustmentModal from './components/AdjustmentModal.vue'
import DeletePrdModal from './components/DeletePrdModal.vue'
import DeleteKnowledgeModal from './components/DeleteKnowledgeModal.vue'
import AnalysisProgress from './components/AnalysisProgress.vue'

const activeView = ref('workbench')
const workspace = ref(null)
const loading = ref(true)
const loadError = ref('')
const showImport = ref(false)
const showMobileMenu = ref(false)
const selectedTaskId = ref('')
const adjustment = ref(null)
const deleteTarget = ref(null)
const deletingPrd = ref(false)
const knowledgeDeleteTarget = ref(null)
const deletingKnowledge = ref(false)
const analyzingPrdId = ref('')
const existingAnalysisProgress = ref(null)
const existingAnalysisElapsed = ref(0)
const globalSearch = ref('')
const toast = ref(null)
let existingAnalysisTimer = null

const navigation = [
  { id: 'workbench', label: '任务工作台', icon: LayoutDashboard },
  { id: 'prds', label: 'PRD 文档', icon: FileText },
  { id: 'knowledge', label: '分配知识库', icon: BookOpen },
]

const selectedTask = computed(() => workspace.value?.tasks.find((task) => task.id === selectedTaskId.value))

async function loadState() {
  try {
    loadError.value = ''
    workspace.value = await api.state()
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

function notify(message, tone = 'success') {
  toast.value = { message, tone, id: Date.now() }
  window.setTimeout(() => {
    if (toast.value?.message === message) toast.value = null
  }, 3600)
}

function navigate(view) {
  activeView.value = view
  showMobileMenu.value = false
}

function applyGlobalSearch(event) {
  globalSearch.value = event.target.value
  activeView.value = 'workbench'
}

function clearGlobalSearch() {
  globalSearch.value = ''
  activeView.value = 'workbench'
}

async function handleImported(prd) {
  await loadState()
  notify(`已导入「${prd.title}」`)
}

async function handleAnalyzed(result) {
  await loadState()
  const actualModel = result.modelTrace?.draft?.responseModel || result.model
  const verification = result.modelTrace?.draft?.responseModel ? `，网关确认 ${actualModel}` : ''
  notify(`已生成 ${result.tasks.length} 个任务${result.reviewed ? '并完成复核' : ''}${verification}，耗时 ${Math.round((result.durationMs || 0) / 1000)} 秒`)
  showImport.value = false
  activeView.value = 'workbench'
}

function openAdjustment(task) {
  selectedTaskId.value = ''
  adjustment.value = { task }
}

async function handleAdjustmentSaved(message) {
  adjustment.value = null
  await loadState()
  notify(message)
}

async function updateStatus(task, status) {
  try {
    await api.updateTaskStatus(task.id, status)
    await loadState()
    notify(`「${task.title}」已更新为${status}`)
  } catch (error) {
    notify(error.message, 'error')
  }
}

async function analyzeExisting(payload) {
  const prd = payload.prd || payload
  const selectedModel = payload.model
  if (!workspace.value.model.configured) {
    notify('请先在 .env.local 中配置 OPENAI_API_KEY', 'error')
    return
  }
  analyzingPrdId.value = prd.id
  existingAnalysisProgress.value = { stage: 'connecting', percent: 2, message: '正在连接模型服务', model: selectedModel || workspace.value.model.model, reasoningEffort: workspace.value.model.reasoningEffort }
  existingAnalysisElapsed.value = 0
  window.clearInterval(existingAnalysisTimer)
  existingAnalysisTimer = window.setInterval(() => { existingAnalysisElapsed.value += 1 }, 1000)
  try {
    notify(`正在分析「${prd.title}」`, 'progress')
    const result = await api.analyzePrd(prd.id, true, {
      model: selectedModel,
      onProgress: (progress) => { existingAnalysisProgress.value = progress },
    })
    await handleAnalyzed(result)
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    window.clearInterval(existingAnalysisTimer)
    existingAnalysisTimer = null
    analyzingPrdId.value = ''
    existingAnalysisProgress.value = null
  }
}

async function deletePrd() {
  if (!deleteTarget.value || deletingPrd.value) return
  deletingPrd.value = true
  try {
    const result = await api.deletePrd(deleteTarget.value.id)
    deleteTarget.value = null
    await loadState()
    notify(`已删除「${result.title}」及 ${result.deletedTaskCount} 个关联任务`)
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    deletingPrd.value = false
  }
}

async function deleteKnowledge() {
  if (!knowledgeDeleteTarget.value || deletingKnowledge.value) return
  deletingKnowledge.value = true
  try {
    const result = await api.deleteKnowledge(knowledgeDeleteTarget.value.id)
    knowledgeDeleteTarget.value = null
    await loadState()
    notify(`已删除「${result.taskTitle}」的知识记录`)
  } catch (error) {
    if (error.code === 'KNOWLEDGE_NOT_FOUND') {
      knowledgeDeleteTarget.value = null
      await loadState()
      notify('该知识记录已不存在，列表已刷新', 'error')
    } else {
      notify(error.message, 'error')
    }
  } finally {
    deletingKnowledge.value = false
  }
}

onMounted(loadState)
onBeforeUnmount(() => window.clearInterval(existingAnalysisTimer))
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ 'sidebar--open': showMobileMenu }">
      <div class="brand-row">
        <div class="brand-mark" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div>
          <strong>分派</strong>
          <small>Agino Flow</small>
        </div>
        <button class="icon-button sidebar-close" title="关闭导航" @click="showMobileMenu = false">
          <X :size="19" />
        </button>
      </div>

      <nav class="main-nav" aria-label="主导航">
        <button
          v-for="item in navigation"
          :key="item.id"
          :class="{ active: activeView === item.id }"
          @click="navigate(item.id)"
        >
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-spacer"></div>
      <div v-if="workspace" class="model-rail-status">
        <div class="status-dot" :class="{ online: workspace.model.configured }"></div>
        <div>
          <span>{{ workspace.model.configured ? '模型已就绪' : '模型未配置' }}</span>
          <small>{{ workspace.model.model }} · {{ workspace.model.reasoningEffort }}</small>
        </div>
      </div>
      <div class="account-row">
        <div class="avatar avatar--account">管</div>
        <div>
          <strong>任务管理员</strong>
          <small>Agino Flutter 组</small>
        </div>
        <Settings2 :size="16" />
      </div>
    </aside>

    <div v-if="showMobileMenu" class="sidebar-scrim" @click="showMobileMenu = false"></div>

    <main class="main-content">
      <header class="topbar">
        <button class="icon-button mobile-menu" title="打开导航" @click="showMobileMenu = true">
          <Menu :size="20" />
        </button>
        <div class="breadcrumb">
          <span>Agino 多端研发</span>
          <strong>{{ navigation.find((item) => item.id === activeView)?.label }}</strong>
        </div>
        <div class="topbar-actions">
          <div class="global-search">
            <Search :size="16" />
            <input :value="globalSearch" aria-label="全局搜索" placeholder="搜索任务、模块或成员" @input="applyGlobalSearch" />
            <button v-if="globalSearch" class="global-search-clear" title="清除全局搜索" @click="clearGlobalSearch"><X :size="14" /></button>
          </div>
          <button class="primary-button" @click="showImport = true">
            <Plus :size="17" />
            <span>导入 PRD</span>
          </button>
        </div>
      </header>

      <div v-if="loading" class="page-state">
        <div class="loader"></div>
        <span>正在载入工作台</span>
      </div>

      <div v-else-if="loadError" class="page-state page-state--error">
        <AlertCircle :size="28" />
        <strong>工作台暂时不可用</strong>
        <span>{{ loadError }}</span>
        <button class="secondary-button" @click="loadState">重新载入</button>
      </div>

      <template v-else>
        <WorkbenchView
          v-if="activeView === 'workbench'"
          :workspace="workspace"
          :external-query="globalSearch"
          @select-task="selectedTaskId = $event.id"
          @update-status="({ task, status }) => updateStatus(task, status)"
          @import="showImport = true"
        />
        <PrdView
          v-else-if="activeView === 'prds'"
          :workspace="workspace"
          :analyzing-prd-id="analyzingPrdId"
          @import="showImport = true"
          @analyze="analyzeExisting"
          @delete="deleteTarget = $event"
        />
        <KnowledgeView v-else :workspace="workspace" @delete="knowledgeDeleteTarget = $event" />
      </template>
    </main>

    <nav class="mobile-nav" aria-label="移动端导航">
      <button
        v-for="item in navigation"
        :key="item.id"
        :class="{ active: activeView === item.id }"
        @click="navigate(item.id)"
      >
        <component :is="item.icon" :size="19" />
        <span>{{ item.label.replace('任务', '').replace('文档', '') }}</span>
      </button>
    </nav>

    <ImportPrdModal
      v-if="showImport"
      :model="workspace?.model"
      @close="showImport = false"
      @imported="handleImported"
      @analyzed="handleAnalyzed"
      @error="(message) => notify(message, 'error')"
    />
    <TaskDrawer
      v-if="selectedTask"
      :task="selectedTask"
      :developers="workspace.developers"
      @close="selectedTaskId = ''"
      @adjust="openAdjustment(selectedTask)"
      @update-status="(status) => updateStatus(selectedTask, status)"
    />
    <AdjustmentModal
      v-if="adjustment"
      :task="adjustment.task"
      :developers="workspace.developers"
      :model-configured="workspace.model.configured"
      @close="adjustment = null"
      @saved="handleAdjustmentSaved"
      @error="(message) => notify(message, 'error')"
    />
    <DeletePrdModal
      v-if="deleteTarget"
      :prd="deleteTarget"
      :saving="deletingPrd"
      @close="deleteTarget = null"
      @confirm="deletePrd"
    />
    <DeleteKnowledgeModal
      v-if="knowledgeDeleteTarget"
      :entry="knowledgeDeleteTarget"
      :saving="deletingKnowledge"
      @close="knowledgeDeleteTarget = null"
      @confirm="deleteKnowledge"
    />

    <Transition name="toast">
      <div v-if="analyzingPrdId && existingAnalysisProgress" class="analysis-progress-float">
        <AnalysisProgress
          :progress="existingAnalysisProgress"
          :elapsed-seconds="existingAnalysisElapsed"
          title="正在重新分析 PRD"
        />
      </div>
    </Transition>

    <Transition name="toast">
      <div v-if="toast" class="toast-message" :class="`toast-message--${toast.tone}`">
        <Check v-if="toast.tone === 'success'" :size="17" />
        <Sparkles v-else-if="toast.tone === 'progress'" :size="17" />
        <AlertCircle v-else :size="17" />
        <span>{{ toast.message }}</span>
      </div>
    </Transition>
  </div>
</template>
