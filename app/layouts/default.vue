<script setup lang="ts">
import FurnaceSidebar from '~/components/sidebar/FurnaceSidebar.vue'

const open = useState<boolean>('dashboard-sidebar-open', () => false)

const { init } = useFurnaceDataset()
const { hydrate } = useFurnaceSelection()

onMounted(async () => {
  hydrate()
  await init()
})
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
          Stoßofen-Analyse
        </p>
      </template>

      <template #default="{ collapsed }">
        <FurnaceSidebar :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
