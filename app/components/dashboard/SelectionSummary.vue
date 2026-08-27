<script setup lang="ts">
import { MODEL_OPTIONS, PHASE_OPTIONS } from '~/types/furnace'

const { selection } = useFurnaceSelection()

const modelLabel = computed(() => MODEL_OPTIONS.find(option => option.key === selection.value.model)?.label ?? selection.value.model)
const phaseLabel = computed(() => PHASE_OPTIONS.find(option => option.key === selection.value.phase)?.label ?? selection.value.phase)
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <span class="text-sm text-muted">Current selection:</span>
    <UBadge
      color="primary"
      variant="subtle"
      icon="i-lucide-brain-circuit"
      :label="modelLabel"
    />
    <UBadge
      color="neutral"
      variant="subtle"
      icon="i-lucide-flame"
      :label="`Zone ${selection.zone}`"
    />
    <UBadge
      color="neutral"
      variant="subtle"
      icon="i-lucide-thermometer"
      :label="phaseLabel"
    />
  </div>
</template>
