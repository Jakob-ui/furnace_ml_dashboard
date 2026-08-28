<script setup lang="ts">
import { VisArea, VisAxis, VisCrosshair, VisLine, VisPlotband, VisPlotbandSelectors, VisPlotline, VisTooltip, VisXYContainer } from '@unovis/vue'
import useFurnaceData, { type FurnaceEvent } from '~/composables/useFurnaceData'
import { formatClock, formatNumber } from '~/utils/format'

type ScoreRow = { x: number, score: number | null }

const data = useFurnaceData()
const { isAnalysis, hasScores, zones } = data
const { model, zone, rowFilter } = useFurnaceSelection()
const { selectedEventId, xDomain, isZoomed, selectEvent, reset } = useChartInteraction()

const active = computed(() =>
  isAnalysis.value
  && model.value != null
  && zone.value != null
  && zones.value.includes(zone.value)
)

const threshold = computed(() =>
  active.value ? data.flagThreshold(model.value!, zone.value!) : 0.5
)

const scoreData = computed<ScoreRow[]>(() => {
  if (!active.value || !hasScores.value) return []
  return data.scoreSeries(model.value!, zone.value!, {
    phase: rowFilter.value.phase,
    from: xDomain.value?.[0] ?? null,
    to: xDomain.value?.[1] ?? null,
    maxPoints: 2000
  }).map((p) => {
    const key = `score_${model.value}_z${zone.value}`
    const v = p[key]
    return { x: p.x, score: v != null && Number.isFinite(v) ? v : null }
  })
})

const events = computed<FurnaceEvent[]>(() => {
  if (!active.value) return []
  return data.eventsFor(model.value!, zone.value!, { phase: rowFilter.value.phase })
})

const x = (d: ScoreRow) => d.x
const y = (d: ScoreRow) => d.score ?? null
const yFill = (d: ScoreRow) => (d.score != null ? Math.max(d.score, threshold.value) : null)

function xTickFormat(v: number): string {
  return Number.isFinite(v) ? formatClock(v) : ''
}

const xDomainProp = computed<[number, number] | undefined>(() => xDomain.value ?? undefined)
const scaleByDomain = computed(() => xDomain.value != null)

function bandColor(event: FurnaceEvent): string {
  return event.id === selectedEventId.value
    ? 'color-mix(in oklch, var(--ui-error) 30%, transparent)'
    : 'color-mix(in oklch, var(--ui-error) 12%, transparent)'
}

function onBandClick(event: FurnaceEvent) {
  if (selectedEventId.value === event.id) reset()
  else selectEvent(event)
}

function crosshairTemplate(d: ScoreRow): string {
  return `<div style="display:flex;flex-direction:column;gap:.15rem">
    <div style="font-weight:600">${formatClock(d.x)}</div>
    <div>Score: ${d.score != null ? formatNumber(d.score) : '–'}</div>
  </div>`
}
</script>

<template>
  <UCard v-if="active" :ui="{ root: 'overflow-visible', body: 'p-0!' }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <p class="font-semibold text-highlighted">
          Anomalie-Score
        </p>
        <UButton
          v-if="isZoomed"
          label="Zoom zurücksetzen"
          icon="i-lucide-zoom-out"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="reset"
        />
      </div>
    </template>

    <div class="px-4 pt-2 pb-3">
      <VisXYContainer
        v-if="hasScores"
        :data="scoreData"
        :x-domain="xDomainProp"
        :y-domain="[0, 1]"
        :scale-by-domain="scaleByDomain"
        :duration="0"
        :margin="{ left: 8, right: 8, top: 8, bottom: 8 }"
        class="h-60 w-full"
      >
        <VisPlotband
          v-for="event in events"
          :key="event.id"
          axis="x"
          :from="event.start"
          :to="event.end"
          :color="bandColor(event)"
          :events="{ [VisPlotbandSelectors.plotband]: { click: () => onBandClick(event) } }"
        />
        <VisArea
          :x="x"
          :y="yFill"
          :baseline="() => threshold"
          color="var(--ui-error)"
          :opacity="0.16"
        />
        <VisLine
          :x="x"
          :y="y"
          color="var(--ui-primary)"
          :line-width="1.5"
        />
        <VisPlotline
          axis="y"
          :value="threshold"
          color="var(--ui-error)"
          :line-width="1"
          :line-style="[4, 3]"
        />
        <VisAxis type="x" :tick-format="xTickFormat" :num-ticks="6" />
        <VisAxis type="y" :tick-format="(t: number) => formatNumber(t)" :num-ticks="3" />
        <VisCrosshair
          :data="scoreData"
          :x="x"
          :y="y"
          :template="crosshairTemplate"
          color="var(--ui-primary)"
          :visibilityThreshold="0"
        />
        <VisTooltip />
      </VisXYContainer>

      <VisXYContainer
        v-else
        :data="[]"
        :x-domain="xDomainProp ?? (data.timeRange.value ?? undefined)"
        :duration="0"
        :margin="{ left: 8, right: 8, top: 8, bottom: 8 }"
        class="h-60 w-full"
      >
        <VisPlotband
          v-for="event in events"
          :key="event.id"
          axis="x"
          :from="event.start"
          :to="event.end"
          :color="bandColor(event)"
          :events="{ [VisPlotbandSelectors.plotband]: { click: () => onBandClick(event) } }"
        />
        <VisAxis type="x" :tick-format="xTickFormat" :num-ticks="6" />
      </VisXYContainer>
    </div>

    <p v-if="!hasScores" class="px-4 pb-3 text-xs text-muted">
      Nur Flag-Ergebnisse vorhanden — anomale Zeitbereiche als Band.
    </p>
  </UCard>
</template>

<style scoped>
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

:deep(.unovis-plotband) {
  cursor: pointer;
}
</style>
