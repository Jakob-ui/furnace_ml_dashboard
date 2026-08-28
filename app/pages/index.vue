<script setup lang="ts">
import DatasetImport from '~/components/navbar/DatasetImport.vue'
import ModeToggle from '~/components/colorMode/modeToggle.vue'
import SelectionSummary from '~/components/dashboard/SelectionSummary.vue'
import ModeNotice from '~/components/dashboard/ModeNotice.vue'
import KpiCards from '~/components/dashboard/KpiCards.vue'
import EventsList from '~/components/dashboard/EventsList.vue'
import useFurnaceData from '~/composables/useFurnaceData'
// TemperatureChart / AnomalyScoreChart sind client/server-gesplittete Komponenten
// und werden über Nuxts globalen Komponenten-Auto-Import aufgelöst.

const { ready, isAnalysis } = useFurnaceData()
const { hasFile, parsing, progress, stage, parseError } = useFurnaceDataset()

const importOpen = useState<boolean>('dataset-import-open', () => false)

const percent = computed(() => Math.round((progress.value ?? 0) * 100))
const stageLabel = computed(() =>
  stage.value === 'reading' ? 'Datei wird gelesen' : 'Datensatz wird eingelesen'
)
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Stoßofen-Anomalieanalyse">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <DatasetImport />
            <ModeToggle />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="parseError && !parsing"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="parseError"
        class="mb-2"
      />

      <UEmpty
        v-if="!hasFile && !parsing"
        icon="i-lucide-upload"
        title="Noch kein Datensatz geladen."
        description="Importiere oben in der Leiste eine aufbereitete Ofen-CSV. Das Dashboard erkennt selbst, ob sie nur Prozessdaten oder zusätzlich Modellergebnisse enthält."
        class="flex-1"
      >
        <template #actions>
          <UButton
            label="CSV importieren"
            icon="i-lucide-upload"
            color="neutral"
            @click="importOpen = true"
          />
        </template>
      </UEmpty>

      <div
        v-else-if="parsing && !ready"
        class="flex flex-1 flex-col items-center justify-center gap-3 py-24"
      >
        <div class="flex w-64 flex-col gap-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted">{{ stageLabel }} …</span>
            <span class="text-muted tabular-nums">{{ percent }} %</span>
          </div>
          <UProgress v-model="percent" :max="100" />
        </div>
      </div>

      <div v-else-if="ready" class="flex flex-col gap-6">
        <SelectionSummary />
        <ModeNotice />
        <KpiCards />

        <TemperatureChart />

        <div v-if="isAnalysis" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <AnomalyScoreChart />
          </div>
          <EventsList />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
