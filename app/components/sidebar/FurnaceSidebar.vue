<script setup lang="ts">
import DatasetUploadField from './DatasetUploadField.vue'
import { MODEL_OPTIONS, PHASE_OPTIONS, ZONE_OPTIONS } from '~/types/furnace'

const { selection, availableSignals, setModel, setZone, setPhase, setSignals, loadPersisted } = useFurnaceSelection()

onMounted(() => {
  loadPersisted()
})

const modelItems = MODEL_OPTIONS.map(option => ({ label: option.label, value: option.key }))
const zoneItems = ZONE_OPTIONS.map(option => ({ label: option.label, value: option.key }))
const phaseItems = PHASE_OPTIONS.map(option => ({ label: option.label, value: option.key }))
const signalItems = computed(() => availableSignals.value.map(signal => ({ label: signal.label, value: signal.key })))

const modelValue = computed({
  get: () => selection.value.model,
  set: value => setModel(value)
})
const zoneValue = computed({
  get: () => selection.value.zone,
  set: value => setZone(value)
})
const phaseValue = computed({
  get: () => selection.value.phase,
  set: value => setPhase(value)
})
const signalsValue = computed({
  get: () => selection.value.signals,
  set: value => setSignals(value)
})
</script>

<template>
  <div class="flex flex-col gap-6 overflow-y-auto p-4">
    <div class="flex flex-col gap-3">
      <p class="text-xs font-semibold tracking-wide text-muted uppercase">
        Dataset
      </p>

      <DatasetUploadField
        slot-name="signals"
        title="Process signals"
        description="CSV with time + zone signal columns"
      />

      <DatasetUploadField
        slot-name="results"
        title="Anomaly results"
        description="CSV with detected events or per-timestamp scores"
      />
    </div>

    <USeparator />

    <div class="flex flex-col gap-4">
      <p class="text-xs font-semibold tracking-wide text-muted uppercase">
        Analysis
      </p>

      <UFormField label="Model">
        <URadioGroup v-model="modelValue" :items="modelItems" />
      </UFormField>

      <UFormField label="Zone">
        <USelect v-model="zoneValue" :items="zoneItems" class="w-full" />
      </UFormField>

      <UFormField label="Phase">
        <USelect v-model="phaseValue" :items="phaseItems" class="w-full" />
      </UFormField>

      <UFormField label="Signals" description="Adapts to the selected zone">
        <USelectMenu
          v-model="signalsValue"
          :items="signalItems"
          value-key="value"
          multiple
          placeholder="Select signals"
          class="w-full"
        />
      </UFormField>
    </div>
  </div>
</template>
