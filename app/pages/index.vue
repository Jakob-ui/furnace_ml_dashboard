<script setup lang="ts">
import Header from '~/components/header/header.vue'
import SelectionSummary from '~/components/dashboard/SelectionSummary.vue'
import KpiCards from '~/components/dashboard/KpiCards.vue'
import EventsList from '~/components/dashboard/EventsList.vue'
// TemperatureChart / AnomalyScoreChart are client/server-split components
// (see components/*.client.vue + *.server.vue) and are resolved through
// Nuxt's global component auto-import instead of a manual import.
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Furnace Anomaly Dashboard">
        <template #left>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <Header />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6">
        <SelectionSummary />
        <KpiCards />
        <TemperatureChart />

        <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div class="xl:col-span-2">
            <AnomalyScoreChart />
          </div>
          <EventsList />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
