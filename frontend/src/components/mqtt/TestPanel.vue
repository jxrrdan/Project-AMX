<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h3 class="font-semibold text-gray-900">Test Integration</h3>
          <p class="text-xs text-gray-500 mt-0.5">{{ integration.name }}</p>
        </div>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>

      <div class="overflow-y-auto flex-1 px-6 py-5 space-y-5">
        <!-- Input -->
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Test Topic</label>
            <input
              v-model="testTopic"
              class="input w-full font-mono text-sm"
              :placeholder="integration.topic_pattern.replace(/[+#]/g, (m) => m === '+' ? 'segment' : 'rest')"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Test Payload (JSON)</label>
            <textarea
              v-model="testPayload"
              class="input w-full font-mono text-sm h-32 resize-none"
              placeholder='{ "field": "value" }'
            />
          </div>
          <button class="btn btn-primary w-full" :disabled="running" @click="run">
            {{ running ? 'Running…' : 'Run Dry-Run Test' }}
          </button>
        </div>

        <!-- Results -->
        <div v-if="result" class="space-y-4">
          <!-- Summary badges -->
          <div class="flex flex-wrap gap-2">
            <span :class="result.topic_matches ? 'badge-green' : 'badge-red'">
              Topic: {{ result.topic_matches ? 'matches' : 'no match' }}
            </span>
            <span :class="result.conditions_pass ? 'badge-green' : 'badge-amber'">
              Conditions: {{ result.conditions_pass ? 'pass' : 'fail' }}
            </span>
            <span :class="result.would_process ? 'badge-green' : 'badge-red'">
              {{ result.would_process ? 'Would process' : 'Would NOT process' }}
            </span>
            <span class="badge-blue">Outlet: {{ result.outlet_id }}</span>
          </div>

          <!-- Missing required fields -->
          <div v-if="result.missing_required_fields.length > 0" class="bg-red-50 rounded-lg px-4 py-3">
            <p class="text-xs font-semibold text-red-700 mb-1">Missing required fields:</p>
            <ul class="text-xs text-red-600 space-y-0.5">
              <li v-for="f in result.missing_required_fields" :key="f">
                <code>{{ f }}</code>
              </li>
            </ul>
          </div>

          <!-- Mapping detail table -->
          <div v-if="result.mapping_detail.length > 0">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Field Mapping Results
            </p>
            <div class="border border-gray-200 rounded-lg overflow-hidden">
              <table class="w-full text-xs">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th class="text-left px-3 py-2 text-gray-500 font-medium">Source</th>
                    <th class="text-left px-3 py-2 text-gray-500 font-medium">Target</th>
                    <th class="text-left px-3 py-2 text-gray-500 font-medium">Raw value</th>
                    <th class="text-left px-3 py-2 text-gray-500 font-medium">Mapped value</th>
                    <th class="text-center px-3 py-2 text-gray-500 font-medium">OK</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, i) in result.mapping_detail"
                    :key="i"
                    :class="i % 2 === 0 ? 'bg-white' : 'bg-gray-50'"
                    class="border-b border-gray-100 last:border-0"
                  >
                    <td class="px-3 py-2 font-mono text-gray-700">{{ row.source_path }}</td>
                    <td class="px-3 py-2 font-mono text-gray-700">{{ row.target_field }}</td>
                    <td class="px-3 py-2 text-gray-500 max-w-[120px] truncate" :title="String(row.raw_value)">
                      {{ row.raw_value != null ? JSON.stringify(row.raw_value) : '—' }}
                    </td>
                    <td class="px-3 py-2 text-gray-700 max-w-[120px] truncate" :title="String(row.mapped_value)">
                      <span v-if="row.error" class="text-red-500">{{ row.error }}</span>
                      <span v-else>{{ row.mapped_value != null ? JSON.stringify(row.mapped_value) : '—' }}</span>
                    </td>
                    <td class="px-3 py-2 text-center">
                      <span v-if="row.satisfied && !row.error" class="text-green-500">✓</span>
                      <span v-else-if="row.required" class="text-red-500">✗</span>
                      <span v-else class="text-gray-300">–</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Mapped payload -->
          <div v-if="result.would_process">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Resulting Payload (would be sent to <code>{{ result.target_entity }}</code> {{ result.target_operation }})
            </p>
            <pre class="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-auto max-h-48">{{ JSON.stringify(result.mapped_payload, null, 2) }}</pre>
          </div>

          <!-- Post-actions -->
          <div v-if="result.post_actions.length > 0">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Post-actions</p>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="a in result.post_actions" :key="a" class="badge-purple text-xs">{{ a }}</span>
            </div>
          </div>
        </div>

        <!-- Error -->
        <div v-if="runError" class="bg-red-50 rounded-lg px-4 py-3 text-sm text-red-600">
          {{ runError }}
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end">
        <button class="btn btn-secondary" @click="$emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { useApi } from '@/composables/useApi'

const props = defineProps<{
  integration: {
    id: string
    name: string
    topic_pattern: string
    target_entity: string
  }
}>()

defineEmits(['close'])

const api = useApi()
const testTopic = ref(props.integration.topic_pattern.replace('#', 'test').replace('+', 'outlet1'))
const testPayload = ref('{\n  \n}')
const running = ref(false)
const result = ref<any>(null)
const runError = ref('')

async function run() {
  runError.value = ''
  result.value = null
  let payload: any
  try {
    payload = JSON.parse(testPayload.value)
  } catch {
    runError.value = 'Invalid JSON in payload.'
    return
  }
  running.value = true
  try {
    result.value = await api.post(`/mqtt-integrations/${props.integration.id}/test`, {
      topic: testTopic.value,
      payload,
    })
  } catch (e: any) {
    runError.value = e?.message || 'Test failed.'
  } finally {
    running.value = false
  }
}
</script>
