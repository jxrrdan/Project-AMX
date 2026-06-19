<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">MQTT Integrations</h2>
        <p class="text-sm text-gray-500 mt-0.5">
          Map MQTT topics from any OEM system to AMX entities — no development required.
        </p>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        <PlusIcon class="h-4 w-4 mr-1" />
        New Integration
      </button>
    </div>

    <!-- Filter bar -->
    <div class="flex gap-3">
      <select v-model="filterEntity" class="input w-44 text-sm">
        <option value="">All entities</option>
        <option v-for="(schema, key) in entitySchema" :key="key" :value="key">
          {{ key }}
        </option>
      </select>
      <select v-model="filterActive" class="input w-36 text-sm">
        <option value="">All statuses</option>
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>
    </div>

    <!-- Integration cards -->
    <div v-if="loading" class="text-center py-12 text-gray-400 text-sm">Loading…</div>
    <div v-else-if="filtered.length === 0" class="text-center py-12 text-gray-400 text-sm">
      No integrations found. Create one to start receiving OEM data.
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="integration in filtered"
        :key="integration.id"
        class="card"
      >
        <div class="card-body flex items-start gap-4">
          <!-- Status dot -->
          <div class="mt-1">
            <span
              :class="integration.is_active ? 'bg-green-400' : 'bg-gray-300'"
              class="h-2.5 w-2.5 rounded-full inline-block"
            />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium text-gray-900 text-sm">{{ integration.name }}</span>
              <span class="badge-blue text-xs">{{ integration.target_entity }}</span>
              <span class="badge-gray text-xs">{{ integration.target_operation }}</span>
            </div>
            <p class="text-xs text-gray-500 font-mono mt-0.5">{{ integration.topic_pattern }}</p>
            <p v-if="integration.description" class="text-xs text-gray-400 mt-0.5">
              {{ integration.description }}
            </p>
            <!-- Stats -->
            <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>{{ integration.total_messages.toLocaleString() }} messages</span>
              <span v-if="integration.total_errors > 0" class="text-red-500">
                {{ integration.total_errors }} errors
              </span>
              <span v-if="integration.last_message_at">
                Last: {{ formatRelative(integration.last_message_at) }}
              </span>
              <span
                v-if="integration.last_message_status"
                :class="{
                  'text-green-600': integration.last_message_status === 'ok',
                  'text-red-500': integration.last_message_status === 'error',
                  'text-amber-500': integration.last_message_status === 'skipped',
                }"
              >
                {{ integration.last_message_status }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 shrink-0">
            <button
              class="btn btn-secondary text-xs px-2.5 py-1"
              @click="openTest(integration)"
            >
              Test
            </button>
            <button
              class="btn btn-secondary text-xs px-2.5 py-1"
              @click="openEdit(integration)"
            >
              Edit
            </button>
            <button
              :class="integration.is_active ? 'btn-danger' : 'btn-secondary'"
              class="btn text-xs px-2.5 py-1"
              @click="toggleActive(integration)"
            >
              {{ integration.is_active ? 'Disable' : 'Enable' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Integration form modal -->
    <IntegrationFormModal
      v-if="showForm"
      :integration="editing"
      :entity-schema="entitySchema"
      @saved="onSaved"
      @close="showForm = false"
    />

    <!-- Test panel modal -->
    <TestPanel
      v-if="showTest && testIntegration"
      :integration="testIntegration"
      @close="showTest = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import IntegrationFormModal from '@/components/mqtt/IntegrationFormModal.vue'
import TestPanel from '@/components/mqtt/TestPanel.vue'
import { useApi } from '@/composables/useApi'

interface MqttIntegration {
  id: string
  name: string
  description?: string
  topic_pattern: string
  target_entity: string
  target_operation: string
  is_active: boolean
  total_messages: number
  total_errors: number
  last_message_at?: string
  last_message_status?: string
  field_mappings: any[]
  conditions: any[]
  post_actions: string[]
  outlet_id_source: string
  qos: number
}

const api = useApi()
const integrations = ref<MqttIntegration[]>([])
const entitySchema = ref<Record<string, any>>({})
const loading = ref(true)
const filterEntity = ref('')
const filterActive = ref('')
const showForm = ref(false)
const showTest = ref(false)
const editing = ref<MqttIntegration | null>(null)
const testIntegration = ref<MqttIntegration | null>(null)

const filtered = computed(() => {
  return integrations.value.filter((i) => {
    if (filterEntity.value && i.target_entity !== filterEntity.value) return false
    if (filterActive.value === 'true' && !i.is_active) return false
    if (filterActive.value === 'false' && i.is_active) return false
    return true
  })
})

async function load() {
  loading.value = true
  try {
    const [list, schema] = await Promise.all([
      api.get('/mqtt-integrations'),
      api.get('/mqtt-integrations/entity-schema'),
    ])
    integrations.value = list
    entitySchema.value = schema
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  showForm.value = true
}

function openEdit(integration: MqttIntegration) {
  editing.value = integration
  showForm.value = true
}

function openTest(integration: MqttIntegration) {
  testIntegration.value = integration
  showTest.value = true
}

async function toggleActive(integration: MqttIntegration) {
  const result = await api.post(`/mqtt-integrations/${integration.id}/toggle`, {})
  integration.is_active = result.is_active
}

function onSaved() {
  showForm.value = false
  load()
}

function formatRelative(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

onMounted(load)
</script>
