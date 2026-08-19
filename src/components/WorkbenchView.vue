<script setup>
import { computed, ref, watch } from 'vue'
import {
  ArrowUpRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FileText,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from 'lucide-vue-next'

const props = defineProps({ workspace: { type: Object, required: true }, externalQuery: { type: String, default: '' } })
const emit = defineEmits(['select-task', 'update-status', 'import', 'analyze-prds'])

const search = ref(props.externalQuery)
const statusFilter = ref('全部')
const assigneeFilter = ref('全部成员')
const taskView = ref('list')
const showAllActivity = ref(false)
const statusOptions = ['全部', '待开始', '进行中', '评审中', '待重分配', '已完成']

watch(() => props.externalQuery, (value) => { search.value = value })

const filteredTasks = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.workspace.tasks.filter((task) => {
    const matchesQuery = !query || `${task.title} ${task.module} ${task.modulePath || ''} ${(task.platforms || []).join(' ')} ${task.assignee}`.toLowerCase().includes(query)
    const matchesStatus = statusFilter.value === '全部' || task.status === statusFilter.value
    const matchesAssignee = assigneeFilter.value === '全部成员' || task.assignee === assigneeFilter.value
    return matchesQuery && matchesStatus && matchesAssignee
  })
})

const metrics = computed(() => {
  const tasks = props.workspace.tasks
  const totalHours = tasks.reduce((sum, item) => sum + Number(item.estimateHours || 0), 0)
  const completed = tasks.filter((item) => item.status === '已完成').length
  return [
    { label: '活跃任务', value: tasks.filter((item) => !['已完成', '已取消'].includes(item.status)).length, suffix: '', tone: 'ink' },
    { label: '全平台工时', value: totalHours, suffix: 'h', tone: 'blue' },
    { label: '等待调整', value: tasks.filter((item) => item.status === '待重分配').length, suffix: '', tone: 'coral' },
    { label: '本期完成率', value: tasks.length ? Math.round(completed / tasks.length * 100) : 0, suffix: '%', tone: 'green' },
  ]
})

const teamLoads = computed(() => props.workspace.developers.map((developer) => {
  const tasks = props.workspace.tasks.filter((task) => task.assignee === developer.name && !['已完成', '已取消'].includes(task.status))
  const hours = tasks.reduce((sum, task) => sum + Number(task.estimateHours || 0), 0)
  return { ...developer, hours, taskCount: tasks.length, ratio: Math.min(100, Math.round(hours / developer.weeklyCapacity * 100)) }
}))

const latestPrd = computed(() => props.workspace.prds[0])
const loadColumns = computed(() => props.workspace.developers.map((developer) => {
  const tasks = filteredTasks.value.filter((task) => task.assignee === developer.name)
  return { ...developer, tasks, hours: tasks.reduce((sum, task) => sum + Number(task.estimateHours || 0), 0) }
}))
const visibleActivity = computed(() => showAllActivity.value ? props.workspace.activity : props.workspace.activity.slice(0, 4))

function statusClass(status) {
  return {
    '待开始': 'status--todo',
    '进行中': 'status--doing',
    '评审中': 'status--review',
    '已完成': 'status--done',
    '待重分配': 'status--reassign',
  }[status] || 'status--todo'
}
</script>

<template>
  <div class="page workbench-page">
    <section class="page-heading">
      <div>
        <p class="eyebrow">AGINO · FLUTTER MULTI-PLATFORM</p>
        <h1>多端开发任务</h1>
        <p>按业务模块、平台主责与全平台累计工时统一分配。</p>
      </div>
      <div class="heading-context" v-if="latestPrd">
        <FileText :size="17" />
        <div>
          <small>当前需求</small>
          <strong>{{ latestPrd.title }}</strong>
        </div>
        <ChevronRight :size="17" />
      </div>
    </section>

    <section class="metric-strip" aria-label="迭代概况">
      <div v-for="metric in metrics" :key="metric.label" class="metric-item">
        <span>{{ metric.label }}</span>
        <strong :class="`metric-value--${metric.tone}`">{{ metric.value }}<small>{{ metric.suffix }}</small></strong>
        <div v-if="metric.label === '本期完成率'" class="micro-progress"><span :style="{ width: `${metric.value}%` }"></span></div>
      </div>
      <button class="metric-action" @click="emit('analyze-prds')">
        <span class="metric-action-icon"><Plus :size="19" /></span>
        <span><strong>分析新需求</strong><small>选择已上传 PRD 并生成多端任务</small></span>
        <ArrowUpRight :size="17" />
      </button>
    </section>

    <div class="workspace-grid">
      <section class="task-panel">
        <div class="panel-header">
          <div>
            <h2>开发任务</h2>
            <span>{{ filteredTasks.length }} / {{ workspace.tasks.length }} 项</span>
          </div>
          <div class="view-switch" aria-label="任务视图">
            <button :class="{ active: taskView === 'list' }" @click="taskView = 'list'">列表</button>
            <button :class="{ active: taskView === 'load' }" @click="taskView = 'load'">负载</button>
          </div>
        </div>

        <div class="filter-row">
          <div class="table-search">
            <Search :size="16" />
            <input v-model="search" placeholder="搜索任务或模块" aria-label="搜索任务" />
          </div>
          <div class="filter-select">
            <Filter :size="15" />
            <select v-model="assigneeFilter" aria-label="按成员筛选">
              <option>全部成员</option>
              <option v-for="developer in workspace.developers" :key="developer.id">{{ developer.name }}</option>
            </select>
          </div>
          <div class="status-tabs">
            <button
              v-for="status in statusOptions"
              :key="status"
              :class="{ active: statusFilter === status }"
              @click="statusFilter = status"
            >{{ status }}</button>
          </div>
        </div>

        <div v-if="taskView === 'list'" class="table-wrap">
          <table class="task-table">
            <thead>
              <tr>
                <th>任务 / 模块</th>
                <th>优先级</th>
                <th>负责人</th>
                <th>工时</th>
                <th>截止</th>
                <th>状态</th>
                <th><span class="sr-only">操作</span></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="task in filteredTasks"
                :key="task.id"
                :class="{ 'row--attention': task.status === '待重分配' }"
                @click="emit('select-task', task)"
              >
                <td>
                  <div class="task-title-cell">
                    <span class="priority-line" :class="`priority-line--${task.priority}`"></span>
                    <div>
                      <strong>{{ task.title }}</strong>
                      <small>{{ task.module }}<template v-if="task.platforms?.length"> · {{ task.platforms.join(' / ') }}</template></small>
                    </div>
                  </div>
                </td>
                <td><span class="priority-text" :class="`priority-text--${task.priority}`">{{ task.priority }}</span></td>
                <td>
                  <div class="assignee-cell">
                    <div class="avatar" :style="{ background: workspace.developers.find((item) => item.name === task.assignee)?.color }">{{ task.assignee?.slice(0, 1) }}</div>
                    <span>{{ task.assignee }}</span>
                  </div>
                </td>
                <td><span class="mono-value">{{ task.estimateHours }}h</span></td>
                <td><span class="date-value">{{ task.dueDate }}</span></td>
                <td>
                  <select
                    class="status-select"
                    :class="statusClass(task.status)"
                    :value="task.status"
                    @click.stop
                    @change="emit('update-status', { task, status: $event.target.value })"
                  >
                    <option>待开始</option><option>进行中</option><option>评审中</option><option>已完成</option><option>待重分配</option>
                  </select>
                </td>
                <td>
                  <button class="icon-button row-action" title="查看任务" @click.stop="emit('select-task', task)"><MoreHorizontal :size="18" /></button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!filteredTasks.length" class="empty-table">
            <FileText :size="24" />
            <strong>{{ workspace.tasks.length ? '没有符合条件的任务' : '暂无开发任务' }}</strong>
            <span>{{ workspace.tasks.length ? '当前筛选范围没有结果。' : '等待第一份 PRD 分析结果。' }}</span>
            <button v-if="!workspace.tasks.length" class="primary-button" @click="emit('import')"><Plus :size="16" />导入 PRD</button>
          </div>
        </div>
        <div v-else class="task-load-board">
          <section v-for="member in loadColumns" :key="member.id" class="task-load-column">
            <header>
              <div class="assignee-cell"><span class="avatar" :style="{ background: member.color }">{{ member.initials }}</span><strong>{{ member.name }}</strong></div>
              <span>{{ member.tasks.length }} 项 · {{ member.hours }}h</span>
            </header>
            <button v-for="task in member.tasks" :key="task.id" class="load-task-card" @click="emit('select-task', task)">
              <strong>{{ task.title }}</strong>
              <span>{{ task.module }} · {{ (task.platforms || []).join(' / ') }}</span>
              <small><i :class="`priority-text priority-text--${task.priority}`">{{ task.priority }}</i><i>{{ task.status }}</i><i>{{ task.estimateHours }}h</i></small>
            </button>
            <div v-if="!member.tasks.length" class="load-column-empty">当前筛选下无任务</div>
          </section>
        </div>
      </section>

      <aside class="insight-panel">
        <section class="insight-section">
          <div class="section-title-row">
            <div><Users :size="17" /><h3>团队负载</h3></div>
            <span>本周 40h / 人</span>
          </div>
          <div class="load-list">
            <div v-for="member in teamLoads" :key="member.id" class="load-item">
              <div class="load-head">
                <div class="assignee-cell">
                  <div class="avatar" :style="{ background: member.color }">{{ member.initials }}</div>
                  <div><strong>{{ member.name }}</strong><small :title="member.role">{{ member.role }} · {{ member.taskCount }} 项</small></div>
                </div>
                <span :class="{ over: member.ratio > 90 }">{{ member.hours }}h <small>/ 40h</small></span>
              </div>
              <div class="load-bar"><span :class="{ over: member.ratio > 90 }" :style="{ width: `${member.ratio}%` }"></span></div>
            </div>
          </div>
        </section>

        <section class="insight-section model-section">
          <div class="section-title-row">
            <div><Sparkles :size="17" /><h3>模型分析</h3></div>
            <span class="model-ready" :class="{ muted: !workspace.model.configured }">{{ workspace.model.configured ? 'READY' : 'OFFLINE' }}</span>
          </div>
          <div class="model-identity">
            <div class="model-icon"><Bot :size="22" /></div>
            <div><strong>{{ workspace.model.model }}</strong><small>分析与复核使用当前环境配置</small></div>
          </div>
          <div class="model-facts">
            <span><CheckCircle2 :size="14" /> 高强度推理</span>
            <span><CheckCircle2 :size="14" /> 不存储响应</span>
            <span><CheckCircle2 :size="14" /> Agino 模块画像</span>
            <span><CheckCircle2 :size="14" /> 全平台负载平衡</span>
          </div>
        </section>

        <section class="insight-section activity-section">
          <div class="section-title-row">
            <div><Clock3 :size="17" /><h3>最近动态</h3></div>
            <button v-if="workspace.activity.length > 4" class="text-action" @click="showAllActivity = !showAllActivity">{{ showAllActivity ? '收起' : '查看全部' }}</button>
          </div>
          <div class="activity-list">
            <div v-for="activity in visibleActivity" :key="activity.id" class="activity-item">
              <span class="activity-marker" :class="`activity-marker--${activity.type}`"></span>
              <div><strong>{{ activity.title }}</strong><p>{{ activity.detail }}</p><small>{{ new Date(activity.createdAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</small></div>
            </div>
            <div v-if="!workspace.activity.length" class="activity-empty">暂无分配动态</div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
