<script setup>
import { AlertTriangle, Bot, CalendarDays, Check, CheckCircle2, CircleDot, Clock3, FileText, GitBranch, RefreshCw, Sparkles, UserRoundX, X } from 'lucide-vue-next'

const props = defineProps({ task: { type: Object, required: true }, developers: { type: Array, required: true } })
const emit = defineEmits(['close', 'adjust', 'update-status'])

const statuses = ['待开始', '进行中', '评审中', '已完成', '待重分配']
</script>

<template>
  <div class="drawer-layer" @mousedown.self="emit('close')">
    <aside class="task-drawer">
      <header class="drawer-header">
        <div><span class="task-id">{{ task.id }}</span><span class="priority-text" :class="`priority-text--${task.priority}`">{{ task.priority }}优先级</span></div>
        <button class="icon-button" title="关闭" @click="emit('close')"><X :size="20" /></button>
      </header>

      <div class="drawer-content">
        <div class="task-heading-block">
          <span>{{ task.module }} · {{ task.workType || '共享实现' }}</span>
          <h2>{{ task.title }}</h2>
          <p>{{ task.description }}</p>
          <div class="task-platforms">
            <span v-for="platform in task.platforms || ['共享 Flutter']" :key="platform">{{ platform }}</span>
            <code v-if="task.modulePath">{{ task.modulePath }}</code>
          </div>
        </div>

        <div class="task-properties">
          <div><UserRoundX :size="16" /><span>负责人</span><strong class="assignee-property"><i class="avatar" :style="{ background: developers.find((item) => item.name === task.assignee)?.color }">{{ task.assignee.slice(0, 1) }}</i>{{ task.assignee }}</strong></div>
          <div><CircleDot :size="16" /><span>状态</span><select :value="task.status" @change="emit('update-status', $event.target.value)"><option v-for="status in statuses" :key="status">{{ status }}</option></select></div>
          <div><Clock3 :size="16" /><span>预估工时</span><strong>{{ task.estimateHours }} 小时</strong></div>
          <div><CalendarDays :size="16" /><span>截止时间</span><strong>{{ task.dueDate }}</strong></div>
        </div>

        <section class="drawer-section">
          <h3><CheckCircle2 :size="17" />验收标准</h3>
          <ul class="criteria-list"><li v-for="item in task.acceptanceCriteria" :key="item"><span><Check :size="13" /></span>{{ item }}</li></ul>
        </section>

        <section v-if="task.dependencies?.length" class="drawer-section">
          <h3><GitBranch :size="17" />任务依赖</h3>
          <div class="dependency-list"><span v-for="item in task.dependencies" :key="item"><FileText :size="14" />{{ item }}</span></div>
        </section>

        <section class="drawer-section reasoning-section">
          <h3><Sparkles :size="17" />分配依据</h3>
          <p>{{ task.reasoning }}</p>
          <div class="reasoning-model"><Bot :size="14" />由模型结合能力、负载与历史调整记录生成</div>
        </section>

        <section v-if="task.lastAdjustmentReason" class="last-adjustment">
          <AlertTriangle :size="17" /><div><strong>最近调整记录</strong><p>{{ task.lastAdjustmentReason }}</p><p v-if="task.lastReassignmentNote">备注：{{ task.lastReassignmentNote }}</p></div>
        </section>
      </div>

      <footer class="drawer-footer">
        <button class="secondary-button" @click="emit('adjust')"><RefreshCw :size="17" />重新分配</button>
        <button v-if="task.status !== '已完成'" class="primary-button" @click="emit('update-status', '已完成')"><Check :size="17" />标记完成</button>
      </footer>
    </aside>
  </div>
</template>
