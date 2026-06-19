<template>
  <div class="p-6 space-y-6">
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="New orders" :value="summary?.orders.received ?? 0" color="blue" />
      <StatCard label="PDI booked" :value="summary?.orders.pdi_booked ?? 0" color="purple" />
      <StatCard label="WIPs open" :value="(summary?.wips.open ?? 0) + (summary?.wips.in_progress ?? 0)" color="amber" />
      <StatCard label="VHC awaiting auth" :value="summary?.vhcs_awaiting_authorisation ?? 0" color="red" />
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- Orders breakdown -->
      <div class="card">
        <div class="card-header">
          <h2 class="text-sm font-semibold text-gray-700">Orders by status</h2>
          <RouterLink to="/orders" class="text-xs text-brand-600 hover:underline">View all</RouterLink>
        </div>
        <div class="card-body divide-y divide-gray-100">
          <StatusRow v-for="(count, status) in summary?.orders" :key="status" :label="formatStatus(status)" :count="count" :color="orderColor(status)" />
        </div>
      </div>

      <!-- Workshop breakdown -->
      <div class="card">
        <div class="card-header">
          <h2 class="text-sm font-semibold text-gray-700">Workshop by status</h2>
          <RouterLink to="/workshop" class="text-xs text-brand-600 hover:underline">View all</RouterLink>
        </div>
        <div class="card-body divide-y divide-gray-100">
          <StatusRow v-for="(count, status) in summary?.wips" :key="status" :label="formatStatus(status)" :count="count" :color="wipColor(status)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { getDashboardSummary } from '@/api/client'
import type { DashboardSummary } from '@/types'

const summary = ref<DashboardSummary | null>(null)
onMounted(async () => { summary.value = await getDashboardSummary() })

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function orderColor(s: string) {
  const map: Record<string, string> = {
    received: 'blue', accessories_invoiced: 'purple', pdi_booked: 'amber',
    pdi_complete: 'amber', ready: 'green', delivered: 'gray',
  }
  return map[s] ?? 'gray'
}

function wipColor(s: string) {
  const map: Record<string, string> = {
    open: 'gray', in_progress: 'blue', awaiting_parts: 'amber',
    awaiting_authorisation: 'red', ready: 'green', invoiced: 'gray',
  }
  return map[s] ?? 'gray'
}
</script>

<script lang="ts">
// Inline sub-components to keep the file self-contained
import { defineComponent, h } from 'vue'

const StatCard = defineComponent({
  props: { label: String, value: Number, color: String },
  setup(props) {
    const colorMap: Record<string, string> = {
      blue: 'text-blue-600 bg-blue-50',
      amber: 'text-amber-600 bg-amber-50',
      red: 'text-red-600 bg-red-50',
      green: 'text-green-600 bg-green-50',
      purple: 'text-purple-600 bg-purple-50',
      gray: 'text-gray-600 bg-gray-50',
    }
    return () =>
      h('div', { class: 'card p-4' }, [
        h('p', { class: 'text-xs font-medium text-gray-500' }, props.label),
        h('p', { class: `mt-1 text-3xl font-bold ${colorMap[props.color ?? 'gray']}` }, props.value ?? 0),
      ])
  },
})

const StatusRow = defineComponent({
  props: { label: String, count: Number, color: String },
  setup(props) {
    const colorMap: Record<string, string> = {
      blue: 'badge-blue', amber: 'badge-amber', red: 'badge-red',
      green: 'badge-green', purple: 'badge-purple', gray: 'badge-gray',
    }
    return () =>
      h('div', { class: 'flex items-center justify-between py-2' }, [
        h('span', { class: 'text-sm text-gray-600' }, props.label),
        h('span', { class: colorMap[props.color ?? 'gray'] }, props.count ?? 0),
      ])
  },
})

export default { components: { StatCard, StatusRow } }
</script>
