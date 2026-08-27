<script setup lang="ts">
import { format } from 'date-fns'
import { VisAxis, VisCrosshair, VisLine, VisPlotband, VisPlotbandSelectors, VisTooltip, VisXYContainer } from '@unovis/vue'
import { AxisType } from '@unovis/ts'
import type { AnomalyEvent } from '~/composables/useAnomalyResults'

type ChartRow = { time: number } & Record<string, number | null>

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)

const { rows, columns } = useFurnaceSignals()
const { selection, availableSignals } = useFurnaceSelection()
const { events } = useAnomalyResults()
const { selectedEventId, zoomDomain, selectEvent, resetZoom } = useChartInteraction()

const PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#ef4444', '#84cc16']

// Only plot signals that both exist in the uploaded CSV and are selected in the sidebar.
const selectedSignals = computed(() => selection.value.signals.filter(key => columns.value.includes(key)))

function signalLabel(key: string): string {
  return availableSignals.value.find(signal => signal.key === key)?.label ?? key
}

const chartData = computed<ChartRow[]>(() =>
  rows.value.map(row => ({
    time: row.time.getTime(),
    ...Object.fromEntries(selectedSignals.value.map(key => [key, row.values[key] ?? null]))
  }))
)

const xDomain = computed<[number, number] | undefined>(() => zoomDomain.value ?? undefined)

function xTickFormat(value: number): string {
  return Number.isFinite(value) ? format(new Date(value), 'HH:mm:ss') : ''
}

function onPlotbandClick(event: AnomalyEvent) {
  if (selectedEventId.value === event.id) {
    resetZoom()
  } else {
    selectEvent(event)
  }
}

const hasSignalData = computed(() => rows.value.length > 0)
const hasSelectedSignals = computed(() => selectedSignals.value.length > 0)
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'px-0! pt-0! pb-3!' }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <p class="font-semibold text-highlighted">
          Temperature Trend
        </p>
        <UButton
          v-if="zoomDomain"
          label="Reset zoom"
          icon="i-lucide-zoom-out"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="resetZoom"
        />
      </div>
    </template>

    <div v-if="!hasSignalData" class="flex h-96 items-center justify-center px-6 text-center text-sm text-muted">
      Upload a process signals CSV to visualize the selected signals.
    </div>
    <div v-else-if="!hasSelectedSignals" class="flex h-96 items-center justify-center px-6 text-center text-sm text-muted">
      Select at least one signal in the sidebar.
    </div>

    <template v-else>
      <div class="flex flex-wrap gap-3 px-4 pb-2">
        <div v-for="(key, index) in selectedSignals" :key="key" class="flex items-center gap-1.5 text-xs text-muted">
          <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: PALETTE[index % PALETTE.length] }" />
          {{ signalLabel(key) }}
        </div>
      </div>

      <VisXYContainer
        :data="chartData"
        :x-domain="xDomain"
        :padding="{ top: 20 }"
        :margin="{ left: -5, right: -5 }"
        class="h-96"
        :width="width"
      >
        <VisPlotband
          v-for="event in events"
          :key="event.id"
          :axis="AxisType.X"
          :from="event.start.getTime()"
          :to="event.end.getTime()"
          :color="selectedEventId === event.id ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.12)'"
          :events="{ [VisPlotbandSelectors.plotband]: { click: () => onPlotbandClick(event) } }"
        />

        <VisLine
          v-for="(key, index) in selectedSignals"
          :key="key"
          :x="(d: ChartRow) => d.time"
          :y="(d: ChartRow) => d[key]"
          :color="PALETTE[index % PALETTE.length]"
        />

        <VisAxis type="x" :x="(d: ChartRow) => d.time" :tick-format="xTickFormat" />
        <VisAxis type="y" />

        <VisCrosshair :color="PALETTE[0]" />
        <VisTooltip />
      </VisXYContainer>
    </template>
  </UCard>
</template>

<style scoped>
:deep(.unovis-plotband) {
  cursor: pointer;
}

.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);

  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
