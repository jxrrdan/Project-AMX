<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex gap-2">
        <input v-model="search" placeholder="Part number or description…" class="input text-sm w-64" @input="debouncedSearch" />
        <label class="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" v-model="lowStockOnly" @change="loadStock" class="rounded" />
          Low stock only
        </label>
      </div>
      <div class="flex gap-2">
        <button class="btn-secondary text-sm" @click="activeTab = 'parts'" :class="activeTab === 'parts' ? 'border-brand-500 text-brand-600' : ''">Parts catalogue</button>
        <button class="btn-secondary text-sm" @click="activeTab = 'stock'" :class="activeTab === 'stock' ? 'border-brand-500 text-brand-600' : ''">Stock levels</button>
      </div>
    </div>

    <!-- Parts catalogue -->
    <div v-if="activeTab === 'parts'" class="card overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Part #</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
            <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
            <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Sell</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr v-if="partsLoading"><td colspan="6" class="py-8 text-center text-sm text-gray-400">Loading…</td></tr>
          <tr v-for="p in parts" :key="p.id">
            <td class="px-4 py-2.5 text-sm font-mono text-gray-700">{{ p.part_number }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-900">{{ p.description }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-500">{{ p.brand_id ?? '—' }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-500">{{ p.category ?? '—' }}</td>
            <td class="px-4 py-2.5 text-sm text-right text-gray-700">£{{ p.unit_cost.toFixed(2) }}</td>
            <td class="px-4 py-2.5 text-sm text-right text-gray-700">£{{ p.unit_sell.toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Stock levels -->
    <div v-else class="card overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Part #</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Outlet</th>
            <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">On hand</th>
            <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Allocated</th>
            <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Bin</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr v-if="stockLoading"><td colspan="6" class="py-8 text-center text-sm text-gray-400">Loading…</td></tr>
          <tr v-for="s in stockLevels" :key="s.id" :class="s.quantity_available <= s.reorder_point ? 'bg-amber-50' : ''">
            <td class="px-4 py-2.5 text-sm font-mono text-gray-700">{{ s.part_number }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-500">{{ s.outlet_id }}</td>
            <td class="px-4 py-2.5 text-sm text-right">{{ s.quantity_on_hand }}</td>
            <td class="px-4 py-2.5 text-sm text-right text-amber-600">{{ s.quantity_allocated }}</td>
            <td class="px-4 py-2.5 text-sm text-right font-medium" :class="s.quantity_available <= s.reorder_point ? 'text-red-600' : 'text-green-600'">
              {{ s.quantity_available }}
            </td>
            <td class="px-4 py-2.5 text-sm text-gray-400">{{ s.bin_location ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listParts, listStock } from '@/api/client'
import type { Part, StockLevel } from '@/types'

const activeTab = ref<'parts' | 'stock'>('parts')
const search = ref('')
const lowStockOnly = ref(false)
const parts = ref<Part[]>([])
const stockLevels = ref<StockLevel[]>([])
const partsLoading = ref(false)
const stockLoading = ref(false)

async function loadParts() {
  partsLoading.value = true
  try { parts.value = await listParts(search.value ? { q: search.value } : undefined) }
  finally { partsLoading.value = false }
}

async function loadStock() {
  stockLoading.value = true
  try { stockLevels.value = await listStock({ low_stock_only: lowStockOnly.value }) }
  finally { stockLoading.value = false }
}

let debounceTimer: ReturnType<typeof setTimeout>
function debouncedSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadParts, 300)
}

onMounted(() => { loadParts(); loadStock() })
</script>
