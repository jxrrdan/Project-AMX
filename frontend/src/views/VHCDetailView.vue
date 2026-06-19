<template>
  <div v-if="vhc" class="p-6 space-y-5">
    <div class="flex items-center gap-3">
      <button @click="router.back()" class="btn-secondary text-xs"><ArrowLeftIcon class="h-3.5 w-3.5" /> Back</button>
      <div>
        <h2 class="text-lg font-semibold text-gray-900">VHC — {{ vhc.vehicle_registration ?? 'No reg' }}</h2>
        <span :class="statusBadge(vhc.status)">{{ fmtStatus(vhc.status) }}</span>
      </div>
    </div>

    <!-- Summary bar -->
    <div class="flex gap-4">
      <div class="card flex-1 p-4 text-center">
        <p class="text-2xl font-bold text-green-600">{{ vhc.pass_count }}</p>
        <p class="text-xs text-gray-500">Pass</p>
      </div>
      <div class="card flex-1 p-4 text-center">
        <p class="text-2xl font-bold text-amber-500">{{ vhc.advisory_count }}</p>
        <p class="text-xs text-gray-500">Advisory</p>
      </div>
      <div class="card flex-1 p-4 text-center">
        <p class="text-2xl font-bold text-red-600">{{ vhc.fail_count }}</p>
        <p class="text-xs text-gray-500">Fail</p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-2" v-if="vhc.status !== 'complete'">
      <button
        v-if="vhc.requires_authorisation && vhc.status === 'in_progress'"
        class="btn-primary text-xs"
        @click="doRequestAuth"
      >
        Request authorisation
      </button>
      <button
        v-if="vhc.status === 'awaiting_authorisation'"
        class="btn-primary text-xs"
        @click="doAuthorise"
      >
        Mark authorised
      </button>
    </div>

    <!-- VHC items by category -->
    <div v-for="(items, category) in groupedItems" :key="category" class="card">
      <div class="card-header capitalize">
        <h3 class="text-sm font-semibold text-gray-700">{{ category }}</h3>
      </div>
      <div class="divide-y divide-gray-100">
        <div v-for="(item, i) in items" :key="i" class="flex items-start gap-4 px-4 py-3">
          <span
            class="mt-0.5 h-3 w-3 rounded-full flex-shrink-0"
            :class="{
              'bg-green-500': item.condition === 'pass',
              'bg-amber-400': item.condition === 'advisory',
              'bg-red-500': item.condition === 'fail',
              'bg-gray-300': item.condition === 'not_checked',
            }"
          />
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-900">{{ item.description }}</p>
            <p v-if="item.measurement" class="text-xs text-gray-500">{{ item.measurement }}</p>
            <p v-if="item.notes" class="text-xs text-amber-700 mt-0.5">{{ item.notes }}</p>
          </div>
          <span class="text-xs capitalize" :class="{
            'text-green-600': item.condition === 'pass',
            'text-amber-600': item.condition === 'advisory',
            'text-red-600': item.condition === 'fail',
            'text-gray-400': item.condition === 'not_checked',
          }">{{ item.condition }}</span>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="p-6 text-sm text-gray-400">Loading…</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import { getVHC, requestVHCAuthorisation, authoriseVHC } from '@/api/client'
import type { VHC, VHCItem } from '@/types'

const route = useRoute()
const router = useRouter()
const vhc = ref<VHC | null>(null)

onMounted(async () => { vhc.value = await getVHC(route.params.id as string) })

const groupedItems = computed(() => {
  if (!vhc.value) return {}
  return vhc.value.items.reduce((acc: Record<string, VHCItem[]>, item) => {
    ;(acc[item.category] ??= []).push(item)
    return acc
  }, {})
})

async function doRequestAuth() {
  if (!vhc.value) return
  vhc.value = await requestVHCAuthorisation(vhc.value.id, 'email')
}

async function doAuthorise() {
  if (!vhc.value) return
  vhc.value = await authoriseVHC(vhc.value.id, 'Customer')
}

function fmtStatus(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }
function statusBadge(s: string) {
  const m: Record<string, string> = { draft: 'badge-gray', in_progress: 'badge-blue', awaiting_authorisation: 'badge-red', authorised: 'badge-green', complete: 'badge-gray' }
  return m[s] ?? 'badge-gray'
}
</script>
