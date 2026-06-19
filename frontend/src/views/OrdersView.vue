<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="s in statuses"
        :key="s.value"
        class="btn text-xs"
        :class="activeStatus === s.value ? 'btn-primary' : 'btn-secondary'"
        @click="setStatus(s.value)"
      >
        {{ s.label }}
      </button>
    </div>

    <div class="card overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Order ref</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Accessories</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Expected delivery</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">PDI</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr v-if="loading"><td colspan="7" class="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
          <tr v-else-if="orders.length === 0"><td colspan="7" class="px-4 py-8 text-center text-sm text-gray-400">No orders</td></tr>
          <tr
            v-for="o in orders"
            :key="o.id"
            class="hover:bg-gray-50 cursor-pointer"
            @click="router.push(`/orders/${o.id}`)"
          >
            <td class="px-4 py-2.5 text-sm font-mono text-gray-700">{{ o.oem_order_ref ?? o.oem_order_id }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-900">{{ o.ordered_model }} {{ o.ordered_derivative }}</td>
            <td class="px-4 py-2.5 text-sm">
              <span v-if="o.accessories_total > 0">
                £{{ o.accessories_total.toFixed(2) }}
                <span :class="o.accessories_invoiced ? 'badge-green ml-1' : 'badge-amber ml-1'">
                  {{ o.accessories_invoiced ? 'Invoiced' : 'To invoice' }}
                </span>
              </span>
              <span v-else class="text-gray-400">None</span>
            </td>
            <td class="px-4 py-2.5 text-sm text-gray-500">{{ fmtDate(o.expected_delivery_date) }}</td>
            <td class="px-4 py-2.5 text-sm">
              <span v-if="o.pdi_planned" class="badge-green">{{ fmtDate(o.pdi_planned_date) }}</span>
              <span v-else class="badge-amber">Not planned</span>
            </td>
            <td class="px-4 py-2.5">
              <span :class="statusBadge(o.status)">{{ fmtStatus(o.status) }}</span>
            </td>
            <td class="px-4 py-2.5 text-right">
              <ChevronRightIcon class="h-4 w-4 text-gray-400 inline" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRightIcon } from '@heroicons/vue/24/outline'
import { listOrders } from '@/api/client'
import type { Order } from '@/types'
import { format, parseISO } from 'date-fns'

const router = useRouter()
const orders = ref<Order[]>([])
const loading = ref(false)
const activeStatus = ref('')

const statuses = [
  { label: 'All', value: '' },
  { label: 'Received', value: 'received' },
  { label: 'Accessories to invoice', value: 'accessories_invoiced' },
  { label: 'PDI booked', value: 'pdi_booked' },
  { label: 'Ready', value: 'ready' },
  { label: 'Delivered', value: 'delivered' },
]

async function load() {
  loading.value = true
  try {
    const params = activeStatus.value ? { status: activeStatus.value } : undefined
    orders.value = await listOrders(params)
  } finally {
    loading.value = false
  }
}

function setStatus(s: string) {
  activeStatus.value = s
  load()
}

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd/MM/yyyy') } catch { return d }
}

function fmtStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    received: 'badge-blue', accessories_invoiced: 'badge-purple',
    pdi_booked: 'badge-amber', pdi_complete: 'badge-amber',
    ready: 'badge-green', delivered: 'badge-gray',
  }
  return map[s] ?? 'badge-gray'
}

onMounted(load)
</script>
