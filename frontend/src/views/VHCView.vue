<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center gap-2">
      <button v-for="s in statuses" :key="s.value" class="btn text-xs"
        :class="activeStatus === s.value ? 'btn-primary' : 'btn-secondary'"
        @click="setStatus(s.value)">
        {{ s.label }}
      </button>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="v in vhcs"
        :key="v.id"
        class="card p-4 cursor-pointer hover:shadow-md transition-shadow"
        @click="router.push(`/vhc/${v.id}`)"
      >
        <div class="flex items-start justify-between mb-2">
          <div>
            <p class="text-sm font-medium text-gray-900">{{ v.vehicle_registration ?? 'No reg' }}</p>
            <p class="text-xs text-gray-500">Tech: {{ v.technician_name ?? 'Unassigned' }}</p>
          </div>
          <span :class="statusBadge(v.status)">{{ fmtStatus(v.status) }}</span>
        </div>
        <div class="flex gap-3 mt-2">
          <div class="flex items-center gap-1 text-xs">
            <span class="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span class="text-gray-600">{{ v.pass_count }} Pass</span>
          </div>
          <div class="flex items-center gap-1 text-xs">
            <span class="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span class="text-gray-600">{{ v.advisory_count }} Advisory</span>
          </div>
          <div class="flex items-center gap-1 text-xs">
            <span class="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span class="text-gray-600">{{ v.fail_count }} Fail</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="py-8 text-center text-sm text-gray-400">Loading…</div>
    <div v-else-if="vhcs.length === 0" class="py-8 text-center text-sm text-gray-400">No VHCs found</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listVHCs } from '@/api/client'
import type { VHC } from '@/types'

const router = useRouter()
const vhcs = ref<VHC[]>([])
const loading = ref(false)
const activeStatus = ref('')

const statuses = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Awaiting authorisation', value: 'awaiting_authorisation' },
  { label: 'Authorised', value: 'authorised' },
  { label: 'Complete', value: 'complete' },
]

async function load() {
  loading.value = true
  try {
    const params = activeStatus.value ? { status: activeStatus.value } : undefined
    vhcs.value = await listVHCs(params)
  } finally {
    loading.value = false
  }
}

function setStatus(s: string) { activeStatus.value = s; load() }

function fmtStatus(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }

function statusBadge(s: string) {
  const m: Record<string, string> = {
    draft: 'badge-gray', in_progress: 'badge-blue',
    awaiting_authorisation: 'badge-red', authorised: 'badge-green',
    declined: 'badge-red', complete: 'badge-gray',
  }
  return m[s] ?? 'badge-gray'
}

onMounted(load)
</script>
