<script setup lang="ts">
import useFurnaceData from '~/composables/useFurnaceData'
import { formatDuration, formatInteger, formatPercent } from '~/utils/format'

const { isAnalysis, kpis, zones } = useFurnaceData()
const { model, zone, rowFilter } = useFurnaceSelection()

const stats = computed(() => {
  if (!isAnalysis.value || model.value == null || zone.value == null) return null
  if (!zones.value.includes(zone.value)) return null
  return kpis(model.value, zone.value, rowFilter.value)
})

const cards = computed(() => {
  if (!stats.value) return []
  return [
    { label: 'Events gesamt', value: formatInteger(stats.value.totalEvents) },
    { label: 'Anomalieanteil', value: formatPercent(stats.value.anomalyRatio) },
    { label: 'Anomaliedauer', value: formatDuration(stats.value.anomalySeconds) }
  ]
})
</script>

<template>
  <div v-if="stats" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <UCard v-for="card in cards" :key="card.label" :ui="{ body: 'flex flex-col gap-1' }">
      <p class="text-xs font-semibold tracking-wide text-muted uppercase">
        {{ card.label }}
      </p>
      <p class="text-2xl font-semibold text-highlighted">
        {{ card.value }}
      </p>
    </UCard>
  </div>
</template>
