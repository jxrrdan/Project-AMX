<template>
  <div class="flex h-screen overflow-hidden bg-gray-50">
    <!-- Sidebar -->
    <aside class="flex w-56 flex-col bg-gray-900">
      <!-- Logo / brand -->
      <div class="flex h-14 items-center gap-2 px-4 border-b border-gray-700">
        <div class="flex h-7 w-7 items-center justify-center rounded bg-brand-600 text-white font-bold text-sm">
          AMX
        </div>
        <span class="text-white font-semibold text-sm tracking-wide">Agent MX</span>
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <NavItem to="/dashboard" :icon="HomeIcon">Dashboard</NavItem>
        <NavItem to="/customers" :icon="UsersIcon">Customers</NavItem>
        <NavItem to="/orders" :icon="ShoppingCartIcon">Orders</NavItem>
        <NavItem to="/workshop" :icon="WrenchScrewdriverIcon">Workshop</NavItem>
        <NavItem to="/parts" :icon="CubeIcon">Parts &amp; Stock</NavItem>
        <NavItem to="/vhc" :icon="ClipboardDocumentCheckIcon">VHC</NavItem>
      </nav>

      <!-- User -->
      <div class="border-t border-gray-700 px-3 py-3">
        <div class="flex items-center gap-2">
          <div class="h-7 w-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-medium">
            {{ initials }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-white truncate">{{ auth.userName }}</p>
            <p class="text-xs text-gray-400 capitalize">{{ auth.userRole }}</p>
          </div>
          <button @click="logout" class="text-gray-400 hover:text-white transition-colors">
            <ArrowRightOnRectangleIcon class="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Top bar -->
      <header class="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <h1 class="text-sm font-semibold text-gray-700">{{ pageTitle }}</h1>
        <div class="flex items-center gap-2">
          <!-- Live indicator -->
          <span class="flex items-center gap-1 text-xs text-gray-500">
            <span :class="wsConnected ? 'bg-green-400' : 'bg-gray-300'" class="h-1.5 w-1.5 rounded-full" />
            {{ wsConnected ? 'Live' : 'Offline' }}
          </span>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import {
  HomeIcon,
  UsersIcon,
  ShoppingCartIcon,
  WrenchScrewdriverIcon,
  CubeIcon,
  ClipboardDocumentCheckIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/vue/24/outline'
import NavItem from './NavItem.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const initials = computed(() => {
  const name = auth.userName || ''
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
})

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  'customer-detail': 'Customer',
  orders: 'Orders',
  'order-detail': 'Order',
  workshop: 'Workshop',
  'wip-detail': 'Job Card',
  parts: 'Parts & Stock',
  vhc: 'Vehicle Health Checks',
  'vhc-detail': 'VHC',
}

const pageTitle = computed(() => PAGE_TITLES[route.name as string] ?? 'AMX')

function logout() {
  auth.logout()
  router.push('/login')
}

// WebSocket for live updates
const wsConnected = ref(false)
let ws: WebSocket | null = null

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${proto}://${location.host}/ws`)
  ws.onopen = () => { wsConnected.value = true }
  ws.onclose = () => {
    wsConnected.value = false
    setTimeout(connectWS, 5000)
  }
  ws.onerror = () => { ws?.close() }
}

onMounted(connectWS)
onUnmounted(() => ws?.close())
</script>
