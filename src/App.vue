<script setup>
import { computed, onMounted, ref } from 'vue'
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

const activeView = ref('workbench')
const workspace = ref(null)
const loading = ref(true)
const loadError = ref('')
const showImport = ref(false)
const importMode = ref('file')
const initialImportPrdIds = ref([])
const showMobileMenu = ref(false)
const selectedTaskId = ref('')
const adjustment = ref(null)
const deleteTarget = ref(null)
const deletingPrd = ref(false)
const knowledgeDeleteTarget = ref(null)
const deletingKnowledge = ref(false)
const globalSearch = ref('')
const toast = ref(null)

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

function openImport(mode = 'file', initialPrdIds = []) {
  importMode.value = mode
  initialImportPrdIds.value = mode === 'library' ? initialPrdIds : []
  showImport.value = true
}

function applyGlobalSearch(event) {
  globalSearch.value = event.target.value
  activeView.value = 'workbench'
}

function clearGlobalSearch() {
  globalSearch.value = ''
  activeView.value = 'workbench'
}

async function handleImported(result) {
  await loadState()
  const messages = []
  if (result.imported.length) messages.push(`已导入 ${result.imported.length} 份`)
  if (result.duplicates.length) messages.push(`跳过 ${result.duplicates.length} 份重复`)
  if (result.failed.length) messages.push(`${result.failed.length} 份读取失败`)
  notify(messages.join('，') || '未导入新的 PRD', result.failed.length ? 'error' : 'success')
}

async function handleBatchAnalyzed(summary) {
  await loadState()
  activeView.value = 'workbench'
  notify(`批量分析完成：${summary.succeeded.length} 份成功，${summary.failed.length} 份失败`, summary.failed.length ? 'error' : 'success')
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

function analyzeExisting(prd) {
  if (!workspace.value.model.configured) {
    notify('请先在 .env.local 中配置 OPENAI_API_KEY', 'error')
    return
  }
  openImport('library', [prd.id])
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
          <button class="primary-button" @click="openImport()">
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
          @import="openImport()"
          @analyze-prds="openImport('library')"
        />
        <PrdView
          v-else-if="activeView === 'prds'"
          :workspace="workspace"
          @import="openImport()"
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
      :workspace="workspace"
      :initial-mode="importMode"
      :initial-prd-ids="initialImportPrdIds"
      @close="showImport = false"
      @imported="handleImported"
      @batch-analyzed="handleBatchAnalyzed"
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
      <div v-if="toast" class="toast-message" :class="`toast-message--${toast.tone}`">
        <Check v-if="toast.tone === 'success'" :size="17" />
        <Sparkles v-else-if="toast.tone === 'progress'" :size="17" />
        <AlertCircle v-else :size="17" />
        <span>{{ toast.message }}</span>
      </div>
    </Transition>
  </div>
</template>
