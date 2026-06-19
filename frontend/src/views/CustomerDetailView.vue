<template>
  <div v-if="customer" class="p-6 space-y-5">
    <!-- Back + header -->
    <div class="flex items-center gap-3">
      <button @click="router.back()" class="btn-secondary text-xs">
        <ArrowLeftIcon class="h-3.5 w-3.5" /> Back
      </button>
      <div>
        <h2 class="text-lg font-semibold text-gray-900">
          {{ customer.title ? `${customer.title} ` : '' }}{{ customer.first_name }} {{ customer.last_name }}
        </h2>
        <p class="text-xs text-gray-500">ID: {{ customer.id }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <!-- Contact details -->
      <div class="card col-span-2">
        <div class="card-header"><h3 class="text-sm font-semibold text-gray-700">Contact details</h3></div>
        <div class="card-body grid grid-cols-2 gap-x-6 gap-y-3">
          <Field label="Email" :value="customer.email" />
          <Field label="Mobile" :value="customer.mobile" />
          <Field label="Phone" :value="customer.phone" />
          <Field label="Postcode" :value="customer.postcode" />
          <Field label="Address" :value="[customer.address_line_1, customer.address_line_2, customer.town, customer.county].filter(Boolean).join(', ')" />
        </div>
      </div>

      <!-- Manufacturer refs -->
      <div class="card">
        <div class="card-header"><h3 class="text-sm font-semibold text-gray-700">OEM references</h3></div>
        <div class="card-body space-y-2">
          <div v-if="customer.manufacturer_refs.length === 0" class="text-sm text-gray-400">None</div>
          <div
            v-for="ref in customer.manufacturer_refs"
            :key="`${ref.brand_id}-${ref.manufacturer_customer_id}`"
            class="rounded bg-gray-50 px-3 py-2 text-xs"
          >
            <p class="font-medium text-gray-700">{{ ref.brand_id }}</p>
            <p class="font-mono text-gray-500">{{ ref.manufacturer_customer_id }}</p>
            <p class="text-gray-400">{{ ref.system_id }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Fuzzy duplicates -->
    <div v-if="matches.length" class="card">
      <div class="card-header">
        <h3 class="text-sm font-semibold text-amber-700">Possible duplicate records</h3>
      </div>
      <div class="card-body divide-y divide-gray-100">
        <div v-for="m in matches" :key="m.customer.id" class="flex items-center justify-between py-2">
          <div>
            <p class="text-sm font-medium text-gray-900">{{ m.customer.first_name }} {{ m.customer.last_name }}</p>
            <p class="text-xs text-gray-500">{{ m.reason }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge-amber">{{ m.score }}% match</span>
            <RouterLink :to="`/customers/${m.customer.id}`" class="text-xs text-brand-600 hover:underline">View</RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="p-6 text-sm text-gray-400">Loading…</div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineComponent, h } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import { getCustomer, getFuzzyMatches } from '@/api/client'
import type { Customer } from '@/types'

const route = useRoute()
const router = useRouter()
const customer = ref<Customer | null>(null)
const matches = ref<any[]>([])

onMounted(async () => {
  const id = route.params.id as string
  customer.value = await getCustomer(id)
  matches.value = await getFuzzyMatches(id)
})

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
