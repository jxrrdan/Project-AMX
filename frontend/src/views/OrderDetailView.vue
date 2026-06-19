<template>
  <div v-if="order" class="p-6 space-y-5">
    <div class="flex items-center gap-3">
      <button @click="router.back()" class="btn-secondary text-xs">
        <ArrowLeftIcon class="h-3.5 w-3.5" /> Back
      </button>
      <div>
        <h2 class="text-lg font-semibold text-gray-900">
          Order {{ order.oem_order_ref ?? order.oem_order_id }}
        </h2>
        <span :class="statusBadge(order.status)">{{ fmtStatus(order.status) }}</span>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <!-- Vehicle info -->
      <div class="card col-span-2">
        <div class="card-header"><h3 class="text-sm font-semibold text-gray-700">Vehicle ordered</h3></div>
        <div class="card-body grid grid-cols-2 gap-x-6 gap-y-3">
          <Field label="Model" :value="`${order.ordered_model} ${order.ordered_derivative ?? ''}`" />
          <Field label="Colour" :value="order.ordered_colour" />
          <Field label="VIN" :value="order.ordered_vin" />
          <Field label="Brand" :value="order.brand_id" />
          <Field label="Order date" :value="fmtDate(order.order_date)" />
          <Field label="Expected delivery" :value="fmtDate(order.expected_delivery_date)" />
        </div>
      </div>

      <!-- Actions -->
      <div class="card">
        <div class="card-header"><h3 class="text-sm font-semibold text-gray-700">Actions</h3></div>
        <div class="card-body space-y-3">
          <div>
            <p class="text-xs text-gray-500 mb-1">Plan PDI date</p>
            <div class="flex gap-2">
              <input type="date" v-model="pdiDate" class="input text-sm flex-1" />
              <button class="btn-primary text-xs" @click="doPlanPDI" :disabled="!pdiDate || planningPDI">
                {{ planningPDI ? '…' : 'Plan' }}
              </button>
            </div>
          </div>
          <div v-if="!order.accessories_invoiced && order.accessories_total > 0">
            <p class="text-xs text-gray-500 mb-1">Accessories (£{{ order.accessories_total.toFixed(2) }})</p>
            <button class="btn-primary text-xs w-full justify-center" @click="doMarkInvoiced">
              Mark as invoiced
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Accessory lines -->
    <div v-if="order.accessory_lines.length" class="card">
      <div class="card-header"><h3 class="text-sm font-semibold text-gray-700">Dealer-fitted accessories</h3></div>
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Part #</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr v-for="(l, i) in order.accessory_lines" :key="i">
            <td class="px-4 py-2 text-sm font-mono text-gray-600">{{ l.part_number }}</td>
            <td class="px-4 py-2 text-sm text-gray-900">{{ l.description }}</td>
            <td class="px-4 py-2 text-sm text-right">{{ l.quantity }}</td>
            <td class="px-4 py-2 text-sm text-right">£{{ l.unit_price.toFixed(2) }}</td>
            <td class="px-4 py-2 text-sm text-right font-medium">£{{ l.total_price.toFixed(2) }}</td>
          </tr>
          <tr class="bg-gray-50">
            <td colspan="4" class="px-4 py-2 text-sm text-right font-semibold text-gray-700">Total</td>
            <td class="px-4 py-2 text-sm text-right font-bold text-gray-900">£{{ order.accessories_total.toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div v-else class="p-6 text-sm text-gray-400">Loading…</div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineComponent, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import { getOrder, planPDI, markAccessoriesInvoiced } from '@/api/client'
import type { Order } from '@/types'
import { format, parseISO } from 'date-fns'

const route = useRoute()
const router = useRouter()
const order = ref<Order | null>(null)
const pdiDate = ref('')
const planningPDI = ref(false)

onMounted(async () => { order.value = await getOrder(route.params.id as string) })

async function doPlanPDI() {
  if (!pdiDate.value || !order.value) return
  planningPDI.value = true
  try { order.value = await planPDI(order.value.id, pdiDate.value) } finally { planningPDI.value = false }
}

async function doMarkInvoiced() {
  if (!order.value) return
  order.value = await markAccessoriesInvoiced(order.value.id)
}

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd/MM/yyyy') } catch { return d }
}

function fmtStatus(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }

function statusBadge(s: string) {
  const m: Record<string, string> = {
    received: 'badge-blue', accessories_invoiced: 'badge-purple',
    pdi_booked: 'badge-amber', ready: 'badge-green', delivered: 'badge-gray',
  }
  return m[s] ?? 'badge-gray'
}

const Field = defineComponent({
  props: { label: String, value: String },
  setup(props) {
    return () => h('div', [
      h('p', { class: 'text-xs text-gray-500' }, props.label),
      h('p', { class: 'text-sm text-gray-900 mt-0.5' }, props.value || '—'),
    ])
  },
})
</script>
