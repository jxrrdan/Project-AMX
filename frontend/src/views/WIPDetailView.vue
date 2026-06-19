<template>
  <div v-if="wip" class="p-6 space-y-5">
    <div class="flex items-center gap-3">
      <button @click="router.back()" class="btn-secondary text-xs"><ArrowLeftIcon class="h-3.5 w-3.5" /> Back</button>
      <div>
        <h2 class="text-lg font-semibold text-gray-900">{{ wip.oem_wip_ref ?? wip.oem_wip_id }}</h2>
        <div class="flex items-center gap-2 mt-0.5">
          <span :class="statusBadge(wip.status)">{{ fmtStatus(wip.status) }}</span>
          <span class="badge-blue capitalize">{{ wip.job_type }}</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <!-- Vehicle & customer -->
      <div class="card col-span-2">
        <div class="card-header"><h3 class="text-sm font-semibold text-gray-700">Job details</h3></div>
        <div class="card-body grid grid-cols-2 gap-x-6 gap-y-3">
          <Field label="Registration" :value="wip.vehicle_registration" />
          <Field label="Vehicle" :value="`${wip.vehicle_make ?? ''} ${wip.vehicle_model ?? ''}`" />
          <Field label="Mileage in" :value="wip.vehicle_mileage_in?.toString()" />
          <Field label="Booking date" :value="fmtDate(wip.booking_date)" />
          <Field label="Promised" :value="fmtDate(wip.promised_date)" />
          <Field label="Technician" :value="wip.allocated_technician_name" />
        </div>
      </div>

      <!-- Status actions -->
      <div class="card">
        <div class="card-header"><h3 class="text-sm font-semibold text-gray-700">Update status</h3></div>
        <div class="card-body space-y-2">
          <button v-for="s in nextStatuses" :key="s.value" class="btn-secondary text-xs w-full justify-center" @click="setStatus(s.value)">
            → {{ s.label }}
          </button>
          <div class="pt-2 border-t">
            <p class="text-xs text-gray-500 mb-1">Labour total</p>
            <p class="text-lg font-bold text-gray-900">£{{ wip.labour_total.toFixed(2) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">Parts total</p>
            <p class="text-lg font-bold text-gray-900">£{{ wip.parts_total.toFixed(2) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Labour lines -->
    <div class="card">
      <div class="card-header"><h3 class="text-sm font-semibold text-gray-700">Labour</h3></div>
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Op code</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Hrs</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
            <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Done</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr v-for="(l, i) in wip.labour_lines" :key="i" :class="l.completed ? 'opacity-60' : ''">
            <td class="px-4 py-2 text-sm font-mono text-gray-600">{{ l.op_code }}</td>
            <td class="px-4 py-2 text-sm text-gray-900">{{ l.description }}</td>
            <td class="px-4 py-2 text-sm text-right">{{ l.hours }}</td>
            <td class="px-4 py-2 text-sm text-right">£{{ l.rate.toFixed(2) }}</td>
            <td class="px-4 py-2 text-sm text-right font-medium">£{{ l.total.toFixed(2) }}</td>
            <td class="px-4 py-2 text-center">
              <span :class="l.completed ? 'badge-green' : 'badge-gray'">{{ l.completed ? 'Yes' : 'No' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Parts lines -->
    <div class="card">
      <div class="card-header">
        <h3 class="text-sm font-semibold text-gray-700">Parts</h3>
        <button class="btn-secondary text-xs" @click="doAllocateParts">Allocate stock</button>
      </div>
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Part #</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
            <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr v-for="(p, i) in wip.parts_lines" :key="i">
            <td class="px-4 py-2 text-sm font-mono text-gray-600">{{ p.part_number }}</td>
            <td class="px-4 py-2 text-sm text-gray-900">{{ p.description }}</td>
            <td class="px-4 py-2 text-sm text-right">{{ p.quantity }}</td>
            <td class="px-4 py-2 text-sm text-right">£{{ p.unit_price.toFixed(2) }}</td>
            <td class="px-4 py-2 text-sm text-right font-medium">£{{ p.total_price.toFixed(2) }}</td>
            <td class="px-4 py-2 text-center">
              <span :class="partsStatusBadge(p.status)">{{ p.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div v-else class="p-6 text-sm text-gray-400">Loading…</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, defineComponent, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import { getWIP, updateWIPStatus, allocateParts } from '@/api/client'
import type { WIP } from '@/types'
import { format, parseISO } from 'date-fns'

const route = useRoute()
const router = useRouter()
const wip = ref<WIP | null>(null)

onMounted(async () => { wip.value = await getWIP(route.params.id as string) })

const STATUS_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  open: [{ value: 'in_progress', label: 'Start job' }],
  in_progress: [
    { value: 'awaiting_parts', label: 'Awaiting parts' },
    { value: 'awaiting_authorisation', label: 'Awaiting authorisation' },
    { value: 'ready', label: 'Mark ready' },
  ],
  awaiting_parts: [{ value: 'in_progress', label: 'Resume' }],
  awaiting_authorisation: [{ value: 'in_progress', label: 'Authorised — resume' }],
  ready: [{ value: 'invoiced', label: 'Mark invoiced' }],
  invoiced: [],
}

const nextStatuses = computed(() => STATUS_TRANSITIONS[wip.value?.status ?? ''] ?? [])

async function setStatus(s: string) {
  if (!wip.value) return
  wip.value = await updateWIPStatus(wip.value.id, s)
}

async function doAllocateParts() {
  if (!wip.value) return
  const result = await allocateParts(wip.value.id)
  if (result.shortages.length) alert(`Parts short: ${result.shortages.join(', ')}`)
  wip.value = await getWIP(wip.value.id)
}

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd/MM/yyyy HH:mm') } catch { return d }
}
function fmtStatus(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }
function statusBadge(s: string) {
  const m: Record<string, string> = { open: 'badge-gray', in_progress: 'badge-blue', awaiting_parts: 'badge-amber', awaiting_authorisation: 'badge-red', ready: 'badge-green', invoiced: 'badge-gray' }
  return m[s] ?? 'badge-gray'
}
function partsStatusBadge(s: string) {
  const m: Record<string, string> = { required: 'badge-gray', picking: 'badge-amber', picked: 'badge-blue', fitted: 'badge-green' }
  return m[s] ?? 'badge-gray'
}

const Field = defineComponent({
  props: { label: String, value: String },
  setup(props) { return () => h('div', [h('p', { class: 'text-xs text-gray-500' }, props.label), h('p', { class: 'text-sm text-gray-900 mt-0.5' }, props.value || '—')]) },
})
</script>
