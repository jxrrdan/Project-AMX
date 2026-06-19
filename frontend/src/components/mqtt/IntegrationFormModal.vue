<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h3 class="font-semibold text-gray-900">
          {{ isEdit ? 'Edit Integration' : 'New Integration' }}
        </h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>

      <div class="overflow-y-auto flex-1 px-6 py-5 space-y-6">
        <!-- Basic info -->
        <section class="space-y-4">
          <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Basic Information
          </h4>
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input v-model="form.name" class="input w-full" placeholder="e.g. BMW Order Feed" />
            </div>
            <div class="col-span-2">
              <label class="block text-xs font-medium text-gray-700 mb-1">
                Description <span class="text-gray-400">(optional)</span>
              </label>
              <input v-model="form.description" class="input w-full" placeholder="What this integration does" />
            </div>
          </div>
        </section>

        <!-- Subscription -->
        <section class="space-y-4">
          <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            MQTT Subscription
          </h4>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Topic Pattern</label>
            <input
              v-model="form.topic_pattern"
              class="input w-full font-mono text-sm"
              placeholder="e.g. ext/+/orders/new  or  oem/bmw/#"
            />
            <p class="text-xs text-gray-400 mt-1">
              Use <code class="bg-gray-100 px-1 rounded">+</code> for a single segment,
              <code class="bg-gray-100 px-1 rounded">#</code> for any remaining segments.
            </p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">QoS</label>
              <select v-model="form.qos" class="input w-full">
                <option :value="0">0 — At most once</option>
                <option :value="1">1 — At least once</option>
                <option :value="2">2 — Exactly once</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Outlet ID Source</label>
              <input
                v-model="form.outlet_id_source"
                class="input w-full font-mono text-sm"
                placeholder="fixed:default"
              />
              <p class="text-xs text-gray-400 mt-1">
                <code>fixed:outlet1</code> | <code>topic:2</code> | <code>payload:outlet_id</code>
              </p>
            </div>
          </div>
        </section>

        <!-- Target -->
        <section class="space-y-4">
          <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Target Entity
          </h4>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Entity Type</label>
              <select v-model="form.target_entity" class="input w-full" @change="onEntityChange">
                <option value="">— select —</option>
                <option v-for="(schema, key) in entitySchema" :key="key" :value="key">
                  {{ key }}
                </option>
              </select>
              <p v-if="currentSchema" class="text-xs text-gray-400 mt-1">
                {{ currentSchema.description }}
              </p>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Operation</label>
              <select v-model="form.target_operation" class="input w-full">
                <option value="create">create</option>
                <option value="update">update</option>
                <option value="upsert">upsert (recommended)</option>
              </select>
            </div>
          </div>
        </section>

        <!-- Conditions -->
        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Conditions <span class="text-gray-400 normal-case font-normal">(all must pass)</span>
            </h4>
            <button class="text-xs text-brand-600 hover:text-brand-700 font-medium" @click="addCondition">
              + Add condition
            </button>
          </div>
          <div v-if="form.conditions.length === 0" class="text-xs text-gray-400">
            No conditions — all messages on this topic will be processed.
          </div>
          <div
            v-for="(cond, i) in form.conditions"
            :key="i"
            class="flex items-center gap-2"
          >
            <input
              v-model="cond.field"
              class="input flex-1 font-mono text-xs"
              placeholder="field.path"
            />
            <select v-model="cond.operator" class="input w-32 text-xs">
              <option value="eq">eq</option>
              <option value="ne">ne</option>
              <option value="in">in</option>
              <option value="not_in">not_in</option>
              <option value="contains">contains</option>
              <option value="exists">exists</option>
              <option value="not_exists">not_exists</option>
            </select>
            <input
              v-if="!['exists','not_exists'].includes(cond.operator)"
              v-model="cond.value"
              class="input w-32 text-xs"
              placeholder="value"
            />
            <button @click="form.conditions.splice(i, 1)" class="text-gray-400 hover:text-red-500">
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </section>

        <!-- Field Mappings -->
        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Field Mappings
            </h4>
            <button class="text-xs text-brand-600 hover:text-brand-700 font-medium" @click="addMapping">
              + Add mapping
            </button>
          </div>
          <div v-if="form.field_mappings.length === 0" class="text-xs text-gray-400">
            No mappings defined yet.
          </div>

          <!-- Column headers -->
          <div v-if="form.field_mappings.length > 0" class="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 text-xs text-gray-400 font-medium px-0.5">
            <span>Source path</span>
            <span>Target field</span>
            <span>Transform</span>
            <span>Req</span>
            <span></span>
          </div>

          <div
            v-for="(mapping, i) in form.field_mappings"
            :key="i"
            class="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center"
          >
            <input
              v-model="mapping.source_path"
              class="input font-mono text-xs"
              placeholder="payload.field  or  @topic.2"
            />
            <div class="relative">
              <input
                v-model="mapping.target_field"
                class="input font-mono text-xs w-full"
                :list="`fields-${i}`"
                placeholder="target_field"
              />
              <datalist v-if="currentSchema" :id="`fields-${i}`">
                <option v-for="(desc, field) in currentSchema.fields" :key="field" :value="field">
                  {{ desc }}
                </option>
              </datalist>
            </div>
            <select v-model="mapping.transform" class="input text-xs">
              <option value="">none</option>
              <option value="uppercase">uppercase</option>
              <option value="lowercase">lowercase</option>
              <option value="strip">strip</option>
              <option value="float">float</option>
              <option value="int">int</option>
              <option value="bool">bool</option>
              <option value="date_iso">date_iso</option>
              <option value="date_uk">date_uk</option>
            </select>
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" v-model="mapping.required" class="rounded border-gray-300" />
              <span class="text-xs text-gray-500">Req</span>
            </label>
            <button @click="form.field_mappings.splice(i, 1)" class="text-gray-400 hover:text-red-500">
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
          <p class="text-xs text-gray-400">
            Source: dot notation (<code class="bg-gray-100 px-1">parent.child</code>), list index
            (<code class="bg-gray-100 px-1">list.0.field</code>), or topic segment
            (<code class="bg-gray-100 px-1">@topic.2</code>).
          </p>
        </section>

        <!-- Post-actions -->
        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Post-actions
            </h4>
            <button class="text-xs text-brand-600 hover:text-brand-700 font-medium" @click="addAction">
              + Add action
            </button>
          </div>
          <div v-if="form.post_actions.length === 0" class="text-xs text-gray-400">
            No post-actions.
          </div>
          <div
            v-for="(action, i) in form.post_actions"
            :key="i"
            class="flex items-center gap-2"
          >
            <input
              :value="action"
              @input="form.post_actions[i] = ($event.target as HTMLInputElement).value"
              class="input flex-1 font-mono text-xs"
              :list="`actions-list`"
              placeholder="notify:booking_confirmation"
            />
            <button @click="form.post_actions.splice(i, 1)" class="text-gray-400 hover:text-red-500">
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
          <datalist id="actions-list">
            <option value="notify:booking_confirmation" />
            <option value="notify:vehicle_ready" />
            <option value="notify:vhc_results" />
            <option value="auto_link_customer" />
            <option value="allocate_parts" />
            <option value="plan_pdi" />
          </datalist>
        </section>

        <!-- Error message -->
        <div v-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
          {{ error }}
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
        <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" v-model="form.is_active" class="rounded border-gray-300" />
          Active
        </label>
        <div class="flex gap-3">
          <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Integration' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { XMarkIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { useApi } from '@/composables/useApi'

interface FieldMapping {
  source_path: string
  target_field: string
  transform: string
  required: boolean
}

interface Condition {
  field: string
  operator: string
  value: string
}

const props = defineProps<{
  integration: any | null
  entitySchema: Record<string, any>
}>()

const emit = defineEmits(['saved', 'close'])

const api = useApi()
const saving = ref(false)
const error = ref('')

const isEdit = computed(() => !!props.integration)

const currentSchema = computed(() =>
  form.value.target_entity ? props.entitySchema[form.value.target_entity] : null
)

function defaultForm() {
  return {
    name: '',
    description: '',
    topic_pattern: '',
    qos: 1,
    outlet_id_source: 'fixed:default',
    target_entity: '',
    target_operation: 'upsert',
    field_mappings: [] as FieldMapping[],
    conditions: [] as Condition[],
    post_actions: [] as string[],
    is_active: true,
  }
}

const form = ref(defaultForm())

watch(
  () => props.integration,
  (val) => {
    if (val) {
      form.value = {
        name: val.name,
        description: val.description || '',
        topic_pattern: val.topic_pattern,
        qos: val.qos,
        outlet_id_source: val.outlet_id_source,
        target_entity: val.target_entity,
        target_operation: val.target_operation,
        field_mappings: val.field_mappings.map((m: any) => ({
          source_path: m.source_path,
          target_field: m.target_field,
          transform: m.transform || '',
          required: m.required || false,
        })),
        conditions: val.conditions.map((c: any) => ({
          field: c.field,
          operator: c.operator,
          value: c.value != null ? String(c.value) : '',
        })),
        post_actions: [...val.post_actions],
        is_active: val.is_active,
      }
    } else {
      form.value = defaultForm()
    }
  },
  { immediate: true }
)

function onEntityChange() {
  // Keep existing mappings but clear target_field if entity changed
}

function addMapping() {
  form.value.field_mappings.push({
    source_path: '',
    target_field: '',
    transform: '',
    required: false,
  })
}

function addCondition() {
  form.value.conditions.push({ field: '', operator: 'eq', value: '' })
}

function addAction() {
  form.value.post_actions.push('')
}

async function save() {
  error.value = ''
  if (!form.value.name.trim()) { error.value = 'Name is required.'; return }
  if (!form.value.topic_pattern.trim()) { error.value = 'Topic pattern is required.'; return }
  if (!form.value.target_entity) { error.value = 'Target entity is required.'; return }

  const body = {
    ...form.value,
    field_mappings: form.value.field_mappings.map((m) => ({
      ...m,
      transform: m.transform || null,
    })),
    conditions: form.value.conditions.map((c) => ({
      ...c,
      value: c.value === '' ? null : c.value,
    })),
    post_actions: form.value.post_actions.filter(Boolean),
  }

  saving.value = true
  try {
    if (isEdit.value && props.integration) {
      await api.patch(`/mqtt-integrations/${props.integration.id}`, body)
    } else {
      await api.post('/mqtt-integrations', body)
    }
    emit('saved')
  } catch (e: any) {
    error.value = e?.message || 'Failed to save integration.'
  } finally {
    saving.value = false
  }
}
</script>
