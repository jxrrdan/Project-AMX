<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-900 px-4">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-lg">
          AMX
        </div>
        <h1 class="text-xl font-bold text-white">Agent Management System</h1>
        <p class="mt-1 text-sm text-gray-400">Sign in to continue</p>
      </div>

      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Email</label>
          <input
            v-model="form.email"
            type="email"
            autocomplete="email"
            required
            class="block w-full rounded-md border-gray-700 bg-gray-800 text-white placeholder-gray-500 text-sm focus:border-brand-500 focus:ring-brand-500"
            placeholder="you@dealership.com"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Password</label>
          <input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            required
            class="block w-full rounded-md border-gray-700 bg-gray-800 text-white placeholder-gray-500 text-sm focus:border-brand-500 focus:ring-brand-500"
          />
        </div>

        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

        <button type="submit" :disabled="loading" class="btn-primary w-full justify-center py-2">
          <span v-if="loading">Signing in…</span>
          <span v-else>Sign in</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const form = ref({ email: '', password: '' })
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(form.value.email, form.value.password)
    router.push('/dashboard')
  } catch {
    error.value = 'Invalid email or password.'
  } finally {
    loading.value = false
  }
}
</script>
