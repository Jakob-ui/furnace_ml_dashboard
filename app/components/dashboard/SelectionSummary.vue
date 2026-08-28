<script setup lang="ts">
import useFurnaceData, { MODEL_LABELS, PHASE_LABELS } from '~/composables/useFurnaceData'

const { isAnalysis, hasPhases } = useFurnaceData()
const { model, zone, phase } = useFurnaceSelection()

const modelLabel = computed(() => (model.value ? MODEL_LABELS[model.value] : null))
const phaseLabel = computed(() => (phase.value === 'all' ? 'Alle Phasen' : PHASE_LABELS[phase.value]))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <span class="text-sm text-muted">Aktuelle Auswahl:</span>

    <UBadge
      v-if="isAnalysis && modelLabel"
      color="primary"
      variant="subtle"
      icon="i-lucide-brain-circuit"
      :label="modelLabel"
    />
    <UBadge
      v-if="zone != null"
      color="neutral"
      variant="subtle"
      icon="i-lucide-flame"
      :label="`Zone ${zone}`"
    />
    <UBadge
      v-if="hasPhases"
      color="neutral"
      variant="subtle"
      icon="i-lucide-thermometer"
      :label="phaseLabel"
    />
  </div>
</template>
