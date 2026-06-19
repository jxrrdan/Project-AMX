<template>
  <div class="p-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="relative w-72">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          v-model="search"
          placeholder="Name, email or postcode…"
          class="input pl-9"
          @input="debouncedSearch"
        />
      </div>
      <button class="btn-primary" @click="showCreate = true">
        <PlusIcon class="h-4 w-4" /> New customer
      </button>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Postcode</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
            <th />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr v-if="loading"><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
          <tr v-else-if="customers.length === 0"><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">No customers found</td></tr>
          <tr
            v-for="c in customers"
            :key="c.id"
            class="hover:bg-gray-50 cursor-pointer"
            @click="router.push(`/customers/${c.id}`)"
          >
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900">
              {{ c.title ? `${c.title} ` : '' }}{{ c.first_name }} {{ c.last_name }}
              <span v-if="c.is_business" class="ml-1 badge-blue">Biz</span>
            </td>
            <td class="px-4 py-2.5 text-sm text-gray-500">{{ c.email ?? '—' }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-500">{{ c.mobile || c.phone || '—' }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-500">{{ c.postcode ?? '—' }}</td>
            <td class="px-4 py-2.5">
              <span :class="c.source === 'mqtt_sync' ? 'badge-purple' : 'badge-gray'">{{ c.source }}</span>
            </td>
            <td class="px-4 py-2.5 text-right">
              <ChevronRightIcon class="h-4 w-4 text-gray-400 inline" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create modal -->
    <CustomerCreateModal v-if="showCreate" @close="showCreate = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MagnifyingGlassIcon, PlusIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'
import { listCustomers } from '@/api/client'
import type { Customer } from '@/types'
import CustomerCreateModal from '@/components/customers/CustomerCreateModal.vue'

const router = useRouter()
const customers = ref<Customer[]>([])
const loading = ref(false)
const search = ref('')
const showCreate = ref(false)

async function load() {
  loading.value = true
  try {
    customers.value = await listCustomers(search.value ? { q: search.value } : undefined)
  } finally {
    loading.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout>
function debouncedSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 350)
}

function onSaved() {
  showCreate.value = false
  load()
}

onMounted(load)
</script>
