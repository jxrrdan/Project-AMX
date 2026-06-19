<template>
  <RouterLink
    :to="to"
    class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
    :class="isActive
      ? 'bg-gray-800 text-white'
      : 'text-gray-400 hover:bg-gray-800 hover:text-white'"
  >
    <component :is="icon" class="h-4 w-4 flex-shrink-0" />
    <slot />
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const props = defineProps<{
  to: string
  icon: object
}>()

const route = useRoute()
const isActive = computed(() => route.path.startsWith(props.to) && props.to !== '/')
</script>
