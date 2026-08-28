<script setup lang="ts">
import useFurnaceData from '~/composables/useFurnaceData'

const { ready, isAnalysis } = useFurnaceData()
</script>

<template>
  <UAlert
    v-if="ready && !isAnalysis"
    color="neutral"
    variant="subtle"
    icon="i-lucide-info"
    title="Dieser Datensatz enthält keine Modellergebnisse."
    description="Sobald score_*- oder flag_*-Spalten enthalten sind, erscheinen hier KPIs, Score-Verlauf und Ereignisliste."
  />
</template>
