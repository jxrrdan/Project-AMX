<template>
  <div class="p-6 space-y-4">
    <!-- Status filters -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="s in columns"
        :key="s.value"
        class="btn text-xs"
        :class="activeStatus === s.value ? 'btn-primary' : 'btn-secondary'"
        @click="setStatus(s.value)"
      >
        {{ s.label }}
      </button>
    </div>

    <!-- WIP cards -->
    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">Loading…</div>
    <div v-else-if="wips.length === 0" class="py-12 text-center text-sm text-gray-400">No jobs found</div>
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <WIPCard
        v-for="wip in wips"
        :key="wip.id"
        :wip="wip"
        @click="router.push(`/workshop/${wip.id}`)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineComponent, h } from 'vue'
import { useRouter } from 'vue-router'
import { listWIPs } from '@/api/client'
import type { WIP } from '@/types'
import { format, parseISO } from 'date-fns'

const router = useRouter()
const wips = ref<WIP[]>([])
const loading = ref(false)
const activeStatus = ref('')

const columns = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Awaiting parts', value: 'awaiting_parts' },
  { label: 'Awaiting auth', value: 'awaiting_authorisation' },
  { label: 'Ready', value: 'ready' },
]

async function load() {
  loading.value = true
  try {
    const params = activeStatus.value ? { status: activeStatus.value } : undefined
    wips.value = await listWIPs(params)
  } finally {
    loading.value = false
  }
}

function setStatus(s: string) {
  activeStatus.value = s
  load()
}

onMounted(load)

const STATUS_CLASSES: Record<string, string> = {
  open: 'badge-gray',
  in_progress: 'badge-blue',
  awaiting_parts: 'badge-amber',
  awaiting_authorisation: 'badge-red',
  ready: 'badge-green',
  invoiced: 'badge-gray',
}

const WIPCard = defineComponent({
  props: { wip: { type: Object as () => WIP, required: true } },
  emits: ['click'],
  setup(props, { emit }) {
    return () => {
      const w = props.wip
      const fmtDate = (d?: string) => {
        if (!d) return '—'
        try { return format(parseISO(d), 'dd/MM') } catch { return d }
      }
      return h('div', {
        class: 'card p-4 cursor-pointer hover:shadow-md transition-shadow',
        onClick: () => emit('click'),
      }, [
        h('div', { class: 'flex items-start justify-between mb-2' }, [
          h('div', [
            h('p', { class: 'text-sm font-medium text-gray-900' }, w.oem_wip_ref ?? w.oem_wip_id),
            h('p', { class: 'text-xs text-gray-500' }, `${w.vehicle_make ?? ''} ${w.vehicle_model ?? ''} ${w.vehicle_registration ?? ''}`),
          ]),
          h('span', { class: STATUS_CLASSES[w.status] ?? 'badge-gray' },
            w.status.replace(/_/g, ' ')),
        ]),
        h('div', { class: 'flex items-center justify-between text-xs text-gray-500 mt-2' }, [
          h('span', { class: 'capitalize badge-blue' }, w.job_type),
          h('span', `Due: ${fmtDate(w.promised_date)}`),
        ]),
        w.allocated_technician_name
          ? h('p', { class: 'mt-1 text-xs text-gray-400' }, `Tech: ${w.allocated_technician_name}`)
          : null,
        h('div', { class: 'mt-2 flex justify-between text-xs font-medium text-gray-700' }, [
          h('span', `Labour: £${w.labour_total.toFixed(2)}`),
          h('span', `Parts: £${w.parts_total.toFixed(2)}`),
        ]),
      ])
    }
  },
})
</script>
