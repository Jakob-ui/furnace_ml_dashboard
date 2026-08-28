<script setup lang="ts">
import useFurnaceData, { MODEL_LABELS, PHASE_LABELS, type PhaseKey } from '~/composables/useFurnaceData'
import { signalsForZone } from '~/utils/signals'

defineProps<{ collapsed?: boolean }>()

const { ready, zones, models, hasPhases, populatedPhases } = useFurnaceData()
const { model, zone, phase, signals } = useFurnaceSelection()

const importOpen = useState<boolean>('dataset-import-open', () => false)

const modelItems = computed(() =>
  models.value.map(key => ({ label: MODEL_LABELS[key], value: key }))
)

const zoneItems = computed(() =>
  zones.value.map(z => ({ label: `Zone ${z}`, value: z }))
)

const PHASE_ORDER: (PhaseKey | 'all')[] = ['all', 'heating', 'hold', 'cooling']
const phaseItems = computed(() =>
  PHASE_ORDER.map(key => ({
    label: key === 'all' ? 'Alle' : PHASE_LABELS[key],
    value: key,
    disabled: key !== 'all' && !populatedPhases.value.has(key)
  }))
)

const signalItems = computed(() => (zone.value == null ? [] : signalsForZone(zone.value)))

// URadioGroup / USelect erwarten `undefined` statt `null`.
const modelProxy = computed({
  get: () => model.value ?? undefined,
  set: (value: string | undefined) => {
    model.value = (value as typeof model.value) ?? null
  }
})
const zoneProxy = computed({
  get: () => zone.value ?? undefined,
  set: (value: number | undefined) => {
    zone.value = value ?? null
  }
})
</script>

<template>
  <div v-if="collapsed" class="flex flex-col items-center gap-3 p-2">
    <UIcon name="i-lucide-sliders-horizontal" class="size-5 text-dimmed" />
  </div>

  <div v-else class="flex flex-col gap-6 overflow-y-auto p-4">
    <section v-if="ready" class="flex flex-col gap-4">
      <p class="text-xs font-semibold tracking-wide text-muted uppercase">
        Analyse
      </p>

      <UFormField v-if="modelItems.length" label="Modell">
        <URadioGroup
          v-model="modelProxy"
          :items="modelItems"
          legend="Modell"
          orientation="vertical"
        />
      </UFormField>

      <UFormField label="Zone">
        <USelect
          v-model="zoneProxy"
          :items="zoneItems"
          class="w-full"
        />
      </UFormField>

      <UFormField v-if="hasPhases" label="Phase">
        <USelect
          v-model="phase"
          :items="phaseItems"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Signale" help="Passt sich der gewählten Zone an.">
        <USelectMenu
          v-model="signals"
          :items="signalItems"
          value-key="value"
          multiple
          placeholder="Signale wählen"
          class="w-full"
        >
          <template #item-trailing="{ item }">
            <span v-if="'suffix' in item && item.suffix" class="text-xs text-dimmed">
              {{ item.suffix }}
            </span>
          </template>
        </USelectMenu>
      </UFormField>
    </section>

    <UEmpty
      v-else
      size="sm"
      variant="naked"
      icon="i-lucide-upload"
      title="Kein Datensatz"
      description="Importiere eine Ofen-CSV über die obere Leiste, dann erscheinen hier Modell, Zone, Phase und Signale."
    >
      <template #actions>
        <UButton
          label="CSV importieren"
          icon="i-lucide-upload"
          size="sm"
          color="neutral"
          variant="subtle"
          @click="importOpen = true"
        />
      </template>
    </UEmpty>
  </div>
</template>
