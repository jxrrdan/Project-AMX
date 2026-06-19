<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16 px-4">
    <div class="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <h2 class="font-semibold text-gray-900">New Customer</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>

      <div class="p-5 overflow-y-auto max-h-[70vh] space-y-5">
        <!-- Personal details -->
        <fieldset class="space-y-3">
          <legend class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Personal details</legend>
          <div class="grid grid-cols-4 gap-3">
            <div>
              <label class="block text-xs text-gray-600 mb-1">Title</label>
              <select v-model="form.title" class="input text-sm">
                <option value="">—</option>
                <option v-for="t in titles" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="col-span-3 grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-600 mb-1">First name *</label>
                <input v-model="form.first_name" required class="input text-sm" />
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">Last name *</label>
                <input v-model="form.last_name" required class="input text-sm" />
              </div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs text-gray-600 mb-1">Email</label>
              <input v-model="form.email" type="email" class="input text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Phone</label>
              <input v-model="form.phone" type="tel" class="input text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Mobile</label>
              <input v-model="form.mobile" type="tel" class="input text-sm" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="block text-xs text-gray-600 mb-1">Address line 1</label>
              <input v-model="form.address_line_1" class="input text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Address line 2</label>
              <input v-model="form.address_line_2" class="input text-sm" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs text-gray-600 mb-1">Town</label>
              <input v-model="form.town" class="input text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">County</label>
              <input v-model="form.county" class="input text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Postcode</label>
              <input v-model="form.postcode" class="input text-sm uppercase" />
            </div>
          </div>
        </fieldset>

        <!-- Vehicle section -->
        <fieldset class="space-y-3">
          <legend class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle (optional)</legend>

          <div class="flex gap-2">
            <input
              v-model="regSearch"
              placeholder="Enter registration e.g. AB12CDE"
              class="input text-sm uppercase flex-1"
              maxlength="8"
              @keydown.enter.prevent="lookupDVLA"
            />
            <button
              type="button"
              class="btn-secondary text-sm"
              :disabled="dvlaLoading || !regSearch"
              @click="lookupDVLA"
            >
              <span v-if="dvlaLoading">Looking up…</span>
              <span v-else>DVLA lookup</span>
            </button>
          </div>

          <p v-if="dvlaError" class="text-xs text-red-500">{{ dvlaError }}</p>

          <div v-if="vehicle" class="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm space-y-1">
            <p class="font-medium text-green-800">{{ vehicle.make }} {{ vehicle.model }}</p>
            <div class="grid grid-cols-3 gap-x-4 text-xs text-green-700">
              <span>Colour: {{ vehicle.colour ?? '—' }}</span>
              <span>Fuel: {{ vehicle.fuel_type ?? '—' }}</span>
              <span>Year: {{ vehicle.year ?? '—' }}</span>
            </div>
          </div>
        </fieldset>
      </div>

      <div class="flex justify-end gap-2 px-5 py-4 border-t bg-gray-50">
        <button class="btn-secondary" @click="$emit('close')">Cancel</button>
        <button class="btn-primary" :disabled="saving || !form.first_name || !form.last_name" @click="save">
          {{ saving ? 'Saving…' : 'Create customer' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { createCustomer, createVehicle } from '@/api/client'
import { api } from '@/api/client'

const emit = defineEmits<{ close: []; saved: [] }>()

const titles = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Prof', 'Rev']

const form = reactive({
  outlet_id: 'default',
  title: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  mobile: '',
  address_line_1: '',
  address_line_2: '',
  town: '',
  county: '',
  postcode: '',
  country: 'GB',
})

const regSearch = ref('')
const dvlaLoading = ref(false)
const dvlaError = ref('')
const vehicle = ref<Record<string, string | number | undefined> | null>(null)
const saving = ref(false)

async function lookupDVLA() {
  if (!regSearch.value) return
  dvlaLoading.value = true
  dvlaError.value = ''
  vehicle.value = null
  try {
    const response = await api.get('/vehicles/dvla-lookup', {
      params: { registration: regSearch.value.replace(/\s/g, '').toUpperCase() },
    })
    vehicle.value = response.data
  } catch (e: any) {
    dvlaError.value = e.response?.data?.detail ?? 'Vehicle not found. Check the registration.'
  } finally {
    dvlaLoading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const customer = await createCustomer({ ...form, title: form.title || undefined })
    if (vehicle.value) {
      await createVehicle({
        outlet_id: form.outlet_id,
        registration: regSearch.value.replace(/\s/g, '').toUpperCase(),
        make: vehicle.value.make as string,
        model: vehicle.value.model as string,
        colour: vehicle.value.colour as string | undefined,
        fuel_type: vehicle.value.fuel_type as string | undefined,
        year: vehicle.value.year as number | undefined,
      })
    }
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>
