<script setup>
import { computed, ref } from 'vue'
import { Bot, Boxes, FileCheck2, FileText, Link2, MonitorSmartphone, Plus, Search, Trash2, UploadCloud } from 'lucide-vue-next'
import { allocationActionLabel, allocationStatusPresentation } from '../prd-allocation-status.js'

const props = defineProps({ workspace: { type: Object, required: true }, analyzingPrdId: { type: String, default: '' } })
const emit = defineEmits(['import', 'analyze', 'delete'])
const query = ref('')

const filteredPrds = computed(() => props.workspace.prds.filter((prd) => !query.value || `${prd.title} ${prd.sourceLabel}`.toLowerCase().includes(query.value.toLowerCase())))

function sourceIcon(type) {
  return type === 'url' ? Link2 : type === 'file' ? FileText : FileCheck2
}
</script>

<template>
  <div class="page">
    <section class="page-heading page-heading--with-action page-heading--prd">
      <div>
        <p class="eyebrow">需求输入</p>
        <h1>PRD 文档</h1>
        <p>结合 Agino 工程模块与五端影响面生成 Flutter 开发任务。</p>
      </div>
      <div class="prd-heading-actions">
        <button class="primary-button" @click="emit('import')"><Plus :size="17" /> 导入 PRD</button>
      </div>
    </section>

    <section class="source-band">
      <div><UploadCloud :size="21" /><span><strong>本地文档</strong><small>PDF · DOCX · MD · TXT</small></span></div>
      <div><Link2 :size="21" /><span><strong>在线地址</strong><small>网页 · 文档直链</small></span></div>
      <div><Boxes :size="21" /><span><strong>工程模块</strong><small>{{ workspace.project.moduleCount }} 个代码模块</small></span></div>
      <div><MonitorSmartphone :size="21" /><span><strong>全平台分析</strong><small>{{ workspace.project.platforms.join(' · ') }}</small></span></div>
      <div><Bot :size="21" /><span><strong>方案复核</strong><small>{{ workspace.model.model }} · {{ workspace.model.reasoningEffort }}</small></span></div>
    </section>

    <section class="document-panel">
      <div class="panel-header">
        <div><h2>文档库</h2><span>{{ filteredPrds.length }} 份需求</span></div>
        <div class="table-search document-search"><Search :size="16" /><input v-model="query" placeholder="搜索 PRD" /></div>
      </div>
      <div class="document-list">
        <article v-for="prd in filteredPrds" :key="prd.id" class="document-row">
          <div class="document-icon"><component :is="sourceIcon(prd.sourceType)" :size="22" /></div>
          <div class="document-main">
            <div><strong>{{ prd.title }}</strong><span v-if="prd.sourceType === 'sample'" class="sample-label">示例</span></div>
            <p>{{ prd.excerpt }}</p>
            <div class="document-meta">
              <span>{{ prd.sourceLabel }}</span><span>{{ prd.contentLength }} 字</span><span>更新于 {{ new Date(prd.updatedAt || prd.createdAt).toLocaleDateString('zh-CN') }}</span>
              <span v-if="prd.analysisModelVerified" class="model-verified">网关已验证：{{ prd.analysisModel }}</span>
              <span v-else-if="prd.analysisModel">历史请求：{{ prd.analysisModel }}（未记录网关返回值）</span>
              <span v-if="prd.analysisTrace?.draft">拆分 {{ Math.round(prd.analysisTrace.draft.durationMs / 1000) }}s · 复核 {{ Math.round((prd.analysisTrace.review?.durationMs || 0) / 1000) }}s</span>
            </div>
          </div>
          <div class="document-result">
            <span class="analysis-state" :class="allocationStatusPresentation(prd.analysisStatus).tone">{{ allocationStatusPresentation(prd.analysisStatus).label }}</span>
            <p v-if="prd.analysisStatus === 'failed' && prd.analysisError" class="document-analysis-error">{{ prd.analysisError }}</p>
            <strong>{{ prd.taskCount || 0 }}<small> 个任务</small></strong>
          </div>
          <button class="secondary-button document-action" :disabled="Boolean(analyzingPrdId) || prd.analysisStatus === 'analyzing'" @click="emit('analyze', prd)">
            <Bot :size="16" />{{ allocationActionLabel(prd.analysisStatus) }}
          </button>
          <button class="icon-button document-delete" title="删除 PRD" :disabled="Boolean(analyzingPrdId)" @click="emit('delete', prd)"><Trash2 :size="18" /></button>
        </article>
        <div v-if="!filteredPrds.length" class="empty-table document-empty">
          <FileText :size="25" />
          <strong>{{ workspace.prds.length ? '没有匹配的 PRD' : '文档库为空' }}</strong>
          <span>{{ workspace.prds.length ? '当前搜索范围没有结果。' : '尚未导入产品需求文档。' }}</span>
          <button v-if="!workspace.prds.length" class="primary-button" @click="emit('import')"><Plus :size="16" />导入 PRD</button>
        </div>
      </div>
    </section>
  </div>
</template>
