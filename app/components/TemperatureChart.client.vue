<script setup lang="ts">
import { VisAxis, VisBrush, VisCrosshair, VisLine, VisPlotband, VisPlotbandSelectors, VisTooltip, VisXYContainer } from '@unovis/vue'
import { Position } from '@unovis/ts'
import useFurnaceData, { type FurnaceEvent } from '~/composables/useFurnaceData'
import { PHASE_LABELS } from '~/composables/useFurnaceData'
import { resolveSignal, signalColor } from '~/utils/signals'
import { formatClock, formatNumber } from '~/utils/format'

type ChartRow = { x: number } & Record<string, number | null>

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)

const data = useFurnaceData()
const { isAnalysis } = data
const { model, zone, phase, signals, rowFilter, setDefaultSignals } = useFurnaceSelection()
const { selectedEventId, xDomain, isZoomed, selectEvent, setDomain, reset } = useChartInteraction()

const MAX_POINTS = 2000

const selectedKeys = computed(() =>
  signals.value.filter(key => data.availableSignalKeys.value.has(key))
)

const hiddenKeys = ref<Set<string>>(new Set())
watch(selectedKeys, () => {
  // Ausgeblendete Einträge, die nicht mehr in der Auswahl sind, vergessen.
  hiddenKeys.value = new Set([...hiddenKeys.value].filter(k => selectedKeys.value.includes(k)))
})

function toggleKey(key: string) {
  const next = new Set(hiddenKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  hiddenKeys.value = next
}

const visibleKeys = computed(() => selectedKeys.value.filter(k => !hiddenKeys.value.has(k)))

// ---- Einheitengruppen -------------------------------------------------- //

const unitOrder = computed<string[]>(() => {
  const counts = new Map<string, number>()
  for (const key of selectedKeys.value) {
    const unit = resolveSignal(key).unit || '—'
    counts.set(unit, (counts.get(unit) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([unit]) => unit)
})

const leftUnit = computed(() => unitOrder.value[0] ?? null)
const rightUnit = computed(() => unitOrder.value[1] ?? null)
const droppedUnits = computed(() => unitOrder.value.slice(2))

function keysForUnit(unit: string | null, keys: string[]): string[] {
  if (!unit) return []
  return keys.filter(k => (resolveSignal(k).unit || '—') === unit)
}

const leftKeys = computed(() => keysForUnit(leftUnit.value, visibleKeys.value))
const rightKeys = computed(() => keysForUnit(rightUnit.value, visibleKeys.value))

const unitHint = computed(() => {
  if (!droppedUnits.value.length) return null
  const shown = [leftUnit.value, rightUnit.value].filter(Boolean).join(' und ')
  const hidden = droppedUnits.value.join(', ')
  const count = unitOrder.value.length
  return `${count} Einheiten ausgewählt — ${shown} werden dargestellt, ${hidden} nicht.`
})

// ---- Daten ----------------------------------------------------------- //

const seriesQuery = computed(() => ({
  keys: selectedKeys.value,
  phase: rowFilter.value.phase,
  from: xDomain.value?.[0] ?? null,
  to: xDomain.value?.[1] ?? null
}))

const chartData = computed<ChartRow[]>(() => {
  const q = seriesQuery.value
  if (!q.keys.length) return []
  return data.series(q.keys, {
    phase: q.phase,
    from: q.from,
    to: q.to,
    maxPoints: MAX_POINTS
  }).map((point) => {
    const row: ChartRow = { x: point.x }
    for (const key of q.keys) {
      const v = point[key]
      row[key] = v != null && Number.isFinite(v) ? v : null
    }
    return row
  })
})

// Übersichtsleiste: volle Zeitachse (nur Phasenfilter), eine Referenzlinie.
const overviewData = computed<ChartRow[]>(() => {
  const key = selectedKeys.value[0]
  if (!key) return []
  return data.series([key], { phase: rowFilter.value.phase, maxPoints: 600 }).map(p => ({
    x: p.x,
    [key]: p[key] != null && Number.isFinite(p[key]) ? p[key] : null
  }))
})
const overviewKey = computed(() => selectedKeys.value[0] ?? null)

// ---- Ereignisbänder ------------------------------------------------- //

const events = computed<FurnaceEvent[]>(() => {
  if (!isAnalysis.value || model.value == null || zone.value == null) return []
  return data.eventsFor(model.value, zone.value, { phase: rowFilter.value.phase })
})

function bandColor(event: FurnaceEvent): string {
  return event.id === selectedEventId.value
    ? 'color-mix(in oklch, var(--ui-error) 26%, transparent)'
    : 'color-mix(in oklch, var(--ui-error) 10%, transparent)'
}

function onBandClick(event: FurnaceEvent) {
  if (selectedEventId.value === event.id) reset()
  else selectEvent(event)
}

// ---- Achsen / Linien ---------------------------------------------- //

const x = (d: ChartRow) => d.x
function yFor(key: string) {
  return (d: ChartRow) => d[key] ?? null
}
function dashFor(key: string): number[] | undefined {
  return resolveSignal(key).role === 'sp' ? [5, 4] : undefined
}

function xTickFormat(value: number): string {
  return Number.isFinite(value) ? formatClock(value) : ''
}

const scaleByDomain = computed(() => xDomain.value != null)
const xDomainProp = computed<[number, number] | undefined>(() => xDomain.value ?? undefined)

function crosshairTemplate(d: ChartRow): string {
  const rows = visibleKeys.value.map((key) => {
    const sig = resolveSignal(key)
    const value = d[key]
    const valueText = value != null ? `${formatNumber(value)}${sig.unit ? ` ${sig.unit}` : ''}` : '–'
    return `<div style="display:flex;gap:.5rem;align-items:center">
      <span style="width:.5rem;height:.5rem;border-radius:9999px;background:${signalColor(key)}"></span>
      <span style="flex:1">${sig.label}</span>
      <span style="font-variant-numeric:tabular-nums">${valueText}</span>
    </div>`
  }).join('')
  return `<div style="display:flex;flex-direction:column;gap:.25rem">
    <div style="font-weight:600">${formatClock(d.x)}</div>${rows}
  </div>`
}

// ---- Brush --------------------------------------------------------- //

function onBrushEnd(selection: [number, number] | undefined) {
  if (!selection) return
  const [a, b] = selection
  if (Math.abs(b - a) < 1000) return
  setDomain([a, b])
}

// ---- Leerzustände ------------------------------------------------- //

const hasSelection = computed(() => selectedKeys.value.length > 0)
const noRowsForPhase = computed(() =>
  hasSelection.value && phase.value !== 'all' && chartData.value.length === 0
)

const panelHeightClass = computed(() =>
  isAnalysis.value ? 'h-[380px]' : 'h-[60vh] min-h-[380px]'
)
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'p-0!' }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <p class="font-semibold text-highlighted">
          Temperaturverlauf
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

    <UEmpty
      v-if="!hasSelection"
      variant="naked"
      icon="i-lucide-line-chart"
      title="Kein Signal gewählt"
      description="Wähle links ein oder mehrere Signale aus."
      :class="panelHeightClass"
    >
      <template #actions>
        <UButton
          label="Temperaturregelung anzeigen"
          color="neutral"
          variant="subtle"
          @click="setDefaultSignals"
        />
      </template>
    </UEmpty>

    <UEmpty
      v-else-if="noRowsForPhase"
      variant="naked"
      icon="i-lucide-filter-x"
      :title="`Keine Zeilen der Phase ${PHASE_LABELS[phase as keyof typeof PHASE_LABELS]}`"
      description="Der Datensatz enthält für diese Phase keine Messwerte."
      :class="panelHeightClass"
    >
      <template #actions>
        <UButton
          label="Alle Phasen anzeigen"
          color="neutral"
          variant="subtle"
          @click="phase = 'all'"
        />
      </template>
    </UEmpty>

    <template v-else>
      <p v-if="unitHint" class="px-4 pt-3 text-xs text-muted">
        {{ unitHint }}
      </p>

      <div class="relative px-2 pt-2" :class="panelHeightClass">
        <VisXYContainer
          :data="chartData"
          :x-domain="xDomainProp"
          :scale-by-domain="scaleByDomain"
          :width="width"
          :margin="{ left: 8, right: rightKeys.length ? 8 : 4, top: 8 }"
          class="absolute inset-0 px-2"
        >
          <VisPlotband
            v-for="event in events"
            :key="event.id"
            :axis="'x'"
            :from="event.start"
            :to="event.end"
            :color="bandColor(event)"
            :events="{ [VisPlotbandSelectors.plotband]: { click: () => onBandClick(event) } }"
          />

          <VisLine
            v-for="key in leftKeys"
            :key="key"
            :x="x"
            :y="yFor(key)"
            :color="signalColor(key)"
            :line-dash-array="dashFor(key)"
            :line-width="dashFor(key) ? 1.25 : 1.75"
          />

          <VisAxis type="x" :tick-format="xTickFormat" :num-ticks="6" />
          <VisAxis type="y" :label="leftUnit ?? ''" :tick-format="(t: number) => formatNumber(t)" />

          <VisCrosshair :template="crosshairTemplate" :color="(_: ChartRow, i: number) => signalColor(visibleKeys[i] ?? '')" />
          <VisTooltip />
        </VisXYContainer>

        <VisXYContainer
          v-if="rightKeys.length"
          :data="chartData"
          :x-domain="xDomainProp"
          :scale-by-domain="scaleByDomain"
          :width="width"
          :margin="{ left: 8, right: 8, top: 8 }"
          class="pointer-events-none absolute inset-0 px-2"
        >
          <VisLine
            v-for="key in rightKeys"
            :key="key"
            :x="x"
            :y="yFor(key)"
            :color="signalColor(key)"
            :line-dash-array="dashFor(key)"
            :line-width="dashFor(key) ? 1.25 : 1.75"
          />
          <VisAxis
            type="y"
            :position="Position.Right"
            :label="rightUnit ?? ''"
            :grid-line="false"
            :tick-format="(t: number) => formatNumber(t)"
          />
        </VisXYContainer>
      </div>

      <div class="h-14 px-2">
        <VisXYContainer
          :data="overviewData"
          :width="width"
          :height="56"
          :margin="{ left: 8, right: 8 }"
        >
          <VisLine
            v-if="overviewKey"
            :x="x"
            :y="yFor(overviewKey)"
            color="var(--ui-text-dimmed)"
            :line-width="1"
          />
          <VisBrush
            :selection="xDomain"
            :on-brush-end="onBrushEnd"
            :draggable="true"
            :selection-min-length="1000"
          />
          <VisAxis type="x" :tick-format="xTickFormat" :num-ticks="4" />
        </VisXYContainer>
      </div>

      <div class="flex flex-wrap gap-x-4 gap-y-1.5 px-4 pt-1 pb-3">
        <button
          v-for="key in selectedKeys"
          :key="key"
          type="button"
          class="flex items-center gap-1.5 text-xs transition-opacity"
          :class="hiddenKeys.has(key) ? 'opacity-40' : ''"
          @click="toggleKey(key)"
        >
          <span
            class="h-2 w-2 rounded-full"
            :style="{ backgroundColor: signalColor(key), outline: resolveSignal(key).role === 'sp' ? `1px dashed ${signalColor(key)}` : 'none', outlineOffset: '1px' }"
          />
          <span class="text-highlighted">{{ resolveSignal(key).label }}</span>
          <span v-if="resolveSignal(key).unit" class="text-dimmed">{{ resolveSignal(key).unit }}</span>
        </button>
      </div>
    </template>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);
  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);
  --vis-axis-label-color: var(--ui-text-muted);
  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}

:deep(.unovis-plotband) {
  cursor: pointer;
}
</style>
