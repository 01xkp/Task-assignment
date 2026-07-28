<script setup>
import { computed, ref } from 'vue'
import { ArrowRight, BookOpen, Bot, BrainCircuit, RefreshCw, Search, ShieldCheck, Trash2, UserRoundX } from 'lucide-vue-next'

const props = defineProps({ workspace: { type: Object, required: true } })
const emit = defineEmits(['delete'])
const query = ref('')
const typeFilter = ref('全部')

const filtered = computed(() => props.workspace.knowledge.filter((item) => {
  const matchesType = typeFilter.value === '全部' || (typeFilter.value === '拒绝' ? item.type === 'rejection' : item.type === 'reassignment')
  const matchesQuery = !query.value || `${item.taskTitle} ${item.reason} ${item.note || ''} ${item.module} ${item.fromAssignee} ${item.toAssignee}`.toLowerCase().includes(query.value.toLowerCase())
  return matchesType && matchesQuery
}))

const stats = computed(() => {
  const knowledge = props.workspace.knowledge
  const rejections = knowledge.filter((item) => item.type === 'rejection')
  const changes = knowledge.filter((item) => item.type === 'reassignment')
  const modules = new Set(knowledge.map((item) => item.module).filter(Boolean))
  return [
    { label: '累计调整记录', value: knowledge.length, icon: BookOpen, tone: 'blue' },
    { label: '拒绝原因', value: rejections.length, icon: UserRoundX, tone: 'coral' },
    { label: '重分配决策', value: changes.length, icon: RefreshCw, tone: 'green' },
    { label: '涉及模块', value: modules.size, icon: ShieldCheck, tone: 'yellow' },
  ]
})
</script>

<template>
  <div class="page">
    <section class="page-heading page-heading--with-action">
      <div>
        <p class="eyebrow">本地学习记录</p>
        <h1>分配知识库</h1>
        <p>记录多端任务调整原因，供后续模块分析与全平台负载分配参考。</p>
      </div>
      <div class="knowledge-state"><BrainCircuit :size="19" /><span><strong>知识增强已启用</strong><small>本地持久化 · 相关性检索</small></span></div>
    </section>

    <section class="knowledge-stats">
      <div v-for="item in stats" :key="item.label" class="knowledge-stat">
        <div :class="`stat-icon stat-icon--${item.tone}`"><component :is="item.icon" :size="19" /></div>
        <span>{{ item.label }}</span><strong>{{ item.value }}</strong>
      </div>
    </section>

    <section class="knowledge-layout">
      <div class="knowledge-records">
        <div class="panel-header">
          <div><h2>调整记录</h2><span>{{ filtered.length }} 条可检索知识</span></div>
          <div class="knowledge-filters">
            <div class="table-search"><Search :size="16" /><input v-model="query" placeholder="搜索原因或模块" /></div>
            <div class="view-switch"><button v-for="type in ['全部', '拒绝', '重分配']" :key="type" :class="{ active: typeFilter === type }" @click="typeFilter = type">{{ type }}</button></div>
          </div>
        </div>
        <div class="knowledge-list">
          <article v-for="entry in filtered" :key="entry.id" class="knowledge-row">
            <div class="knowledge-type" :class="`knowledge-type--${entry.type}`"><UserRoundX v-if="entry.type === 'rejection'" :size="17" /><RefreshCw v-else :size="17" /></div>
            <div class="knowledge-copy">
              <div><strong>{{ entry.taskTitle }}</strong><span>{{ entry.module }}</span></div>
              <p>{{ entry.reason }}</p>
              <p v-if="entry.note" class="knowledge-note">备注：{{ entry.note }}</p>
              <div class="movement">
                <span>{{ entry.fromAssignee || '未分配' }}</span>
                <ArrowRight :size="14" />
                <span>{{ entry.toAssignee || '待重新分配' }}</span>
                <small>{{ new Date(entry.createdAt).toLocaleDateString('zh-CN') }} · {{ entry.source === 'ai' ? 'AI 建议' : '人工决策' }}</small>
              </div>
            </div>
            <button class="icon-button knowledge-delete" title="删除知识记录" aria-label="删除知识记录" @click="emit('delete', entry)"><Trash2 :size="17" /></button>
          </article>
          <div v-if="!filtered.length" class="empty-table"><BookOpen :size="24" /><strong>没有匹配的知识记录</strong></div>
        </div>
      </div>

      <aside class="knowledge-aside">
        <div class="aside-heading"><Bot :size="19" /><div><strong>模型如何参考</strong><span>{{ workspace.model.model }}</span></div></div>
        <div class="retrieval-flow">
          <div><span>01</span><div><strong>Agino 模块匹配</strong><small>feature、代码路径与平台影响面</small></div></div>
          <div><span>02</span><div><strong>历史原因排序</strong><small>相关性与发生时间综合排序</small></div></div>
          <div><span>03</span><div><strong>全平台负载复核</strong><small>主责边界、累计工时与任务依赖</small></div></div>
        </div>
        <div class="privacy-note"><ShieldCheck :size="17" /><p><strong>数据留在本地</strong><span>知识记录保存在项目 data 目录，模型响应存储已关闭。</span></p></div>
      </aside>
    </section>
  </div>
</template>
