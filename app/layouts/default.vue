<script setup lang="ts">
import FurnaceSidebar from '~/components/sidebar/FurnaceSidebar.vue'

const open = ref(false)
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      :default-size="18"
      :min-size="15"
      :max-size="28"
      class="bg-elevated/25"
    >
      <template #header>
        <p class="text-sm font-semibold text-highlighted">
          Furnace Analysis
        </p>
      </template>

      <FurnaceSidebar />
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
