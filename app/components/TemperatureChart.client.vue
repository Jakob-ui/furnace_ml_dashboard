<script setup lang="ts">
import { VisAxis, VisCrosshair, VisLine, VisPlotband, VisPlotbandSelectors, VisTooltip, VisXYContainer } from '@unovis/vue'
import useFurnaceData, { type FurnaceEvent } from '~/composables/useFurnaceData'
import { PHASE_LABELS } from '~/composables/useFurnaceData'
import { resolveSignal, signalColor } from '~/utils/signals'
import { formatClock, formatDateTime, formatNumber, formatRange } from '~/utils/format'

type ChartRow = { x: number } & Record<string, number | null>

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

// ---- Einheitengruppen: je Einheit ein eigenes Panel ------------------- //

const unitOrder = computed<string[]>(() => {
  const counts = new Map<string, number>()
  for (const key of selectedKeys.value) {
    const unit = resolveSignal(key).unit || '—'
    counts.set(unit, (counts.get(unit) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([unit]) => unit)
})

function keysForUnit(unit: string, keys: string[]): string[] {
  return keys.filter(k => (resolveSignal(k).unit || '—') === unit)
}
function visibleKeysForUnit(unit: string): string[] {
  return keysForUnit(unit, visibleKeys.value)
}
function unitLabel(unit: string): string {
  return unit === '—' ? '' : unit
}
function panelHeightClass(index: number): string {
  const n = unitOrder.value.length
  if (n === 1) return 'h-[320px]'
  return index === n - 1 ? 'h-[236px]' : 'h-[172px]'
}

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

// ---- Zeitausschnitt / Zoom ---------------------------------------- //

const fullDomain = computed<[number, number]>(() => data.timeRange.value ?? [0, 1])
const zoomStep = computed(() =>
  Math.max(1000, Math.round((fullDomain.value[1] - fullDomain.value[0]) / 500))
)

const zoomRange = ref<number[]>([...fullDomain.value])
watch([xDomain, fullDomain], () => {
  zoomRange.value = xDomain.value ? [...xDomain.value] : [...fullDomain.value]
}, { immediate: true })

function applyZoom() {
  const [a, b] = zoomRange.value as [number, number]
  if (b - a < zoomStep.value) {
    // Zu schmal — auf gültigen Bereich zurücksetzen.
    zoomRange.value = xDomain.value ? [...xDomain.value] : [...fullDomain.value]
    return
  }
  if (a <= fullDomain.value[0] && b >= fullDomain.value[1]) reset()
  else setDomain([a, b])
}

const zoomLabel = computed(() => {
  const [a, b] = zoomRange.value as [number, number]
  if (a <= fullDomain.value[0] && b >= fullDomain.value[1]) return 'Gesamter Zeitraum'
  return formatRange(a, b)
})

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

function buildCrosshair(d: ChartRow | undefined, keys: string[]): string {
  if (!d) return ''
  const rows = keys.map((key) => {
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

// Stabile Accessor-/Template-Funktionen je Einheit. Neu berechnet nur, wenn sich
// Einheiten oder sichtbare Signale ändern — nicht bei jedem Daten-Update. Sonst
// baut Unovis das Crosshair bei jedem Hover neu auf und der Strich „klebt".
interface CrosshairFns {
  ys: ((d: ChartRow) => number | null)[]
  color: (d: ChartRow, i: number) => string
  template: (d: ChartRow | undefined) => string
}
const crosshairByUnit = computed(() => {
  const map = new Map<string, CrosshairFns>()
  for (const unit of unitOrder.value) {
    const keys = visibleKeysForUnit(unit)
    map.set(unit, {
      ys: keys.map(k => yFor(k)),
      color: (_d: ChartRow, i: number) => signalColor(keys[i] ?? ''),
      template: (d: ChartRow | undefined) => buildCrosshair(d, keys)
    })
  }
  return map
})
function crosshairFor(unit: string): CrosshairFns | undefined {
  return crosshairByUnit.value.get(unit)
}

// ---- Leerzustände ------------------------------------------------- //

const zoneInDataset = computed(() =>
  zone.value == null || data.zones.value.includes(zone.value)
)
const hasSelection = computed(() => selectedKeys.value.length > 0)
const noRowsForPhase = computed(() =>
  hasSelection.value && phase.value !== 'all' && chartData.value.length === 0
)

const emptyHeightClass = computed(() =>
  isAnalysis.value ? 'h-[380px]' : 'h-[60vh] min-h-[380px]'
)
</script>

<template>
  <UCard :ui="{ root: 'overflow-visible', body: 'p-0!' }">
    <template #header>
      <p class="font-semibold text-highlighted">
        Temperaturverlauf
      </p>
    </template>

    <UEmpty
      v-if="!zoneInDataset"
      variant="naked"
      icon="i-lucide-flame-kindling"
      :title="`Zone ${zone} ist nicht im Datensatz enthalten`"
      description="Diese CSV enthält keine Spalten für diese Zone."
      :class="emptyHeightClass"
    >
      <template v-if="data.zones.value.length" #actions>
        <UButton
          v-for="z in data.zones.value"
          :key="z"
          :label="`Zu Zone ${z}`"
          color="neutral"
          variant="subtle"
          @click="zone = z"
        />
      </template>
    </UEmpty>

    <UEmpty
      v-else-if="!hasSelection"
      variant="naked"
      icon="i-lucide-line-chart"
      title="Kein Signal gewählt"
      description="Wähle links ein oder mehrere Signale aus."
      :class="emptyHeightClass"
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
      :class="emptyHeightClass"
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
      <!-- Je Einheit ein eigenes Panel, alle mit derselben Zeitachse -->
      <div class="divide-y divide-default">
        <div
          v-for="(unit, i) in unitOrder"
          :key="unit"
          class="px-4 pt-2"
          :class="i === unitOrder.length - 1 ? 'pb-3' : 'pb-1'"
        >
          <VisXYContainer
            :data="chartData"
            :x-domain="xDomainProp"
            :scale-by-domain="scaleByDomain"
            :duration="0"
            :auto-margin="false"
            :margin="{ left: 56, right: 14, top: 8, bottom: i === unitOrder.length - 1 ? 26 : 6 }"
            :class="[panelHeightClass(i), 'w-full']"
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
            <VisLine
              v-for="key in visibleKeysForUnit(unit)"
              :key="key"
              :x="x"
              :y="yFor(key)"
              :color="signalColor(key)"
              :line-dash-array="dashFor(key)"
              :line-width="dashFor(key) ? 1.25 : 1.75"
            />
            <VisAxis
              type="y"
              :label="unitLabel(unit)"
              :num-ticks="4"
              :tick-format="(t: number) => formatNumber(t)"
            />
            <VisAxis
              v-if="i === unitOrder.length - 1"
              type="x"
              :tick-format="xTickFormat"
              :num-ticks="6"
            />
            <VisCrosshair
              :data="chartData"
              :x="x"
              :y="crosshairFor(unit)?.ys"
              :template="crosshairFor(unit)?.template"
              :color="crosshairFor(unit)?.color"
              :visibilityThreshold="0"
            />
            <VisTooltip />
          </VisXYContainer>
        </div>
      </div>

      <div class="flex flex-col gap-2 border-t border-default bg-elevated/30 px-4 py-3 print:hidden">
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div class="flex items-center gap-1.5 text-sm">
            <UIcon name="i-lucide-scan-search" class="size-4 shrink-0 text-dimmed" />
            <span class="font-medium text-highlighted">Zeitausschnitt</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-highlighted tabular-nums">{{ zoomLabel }}</span>
            <UButton
              label="Zurücksetzen"
              icon="i-lucide-zoom-out"
              size="xs"
              color="neutral"
              variant="subtle"
              :disabled="!isZoomed"
              @click="reset"
            />
          </div>
        </div>
        <USlider
          v-model="zoomRange"
          :min="fullDomain[0]"
          :max="fullDomain[1]"
          :step="zoomStep"
          :min-steps-between-thumbs="1"
          size="sm"
          class="w-full"
          @change="applyZoom"
        />
        <div class="flex justify-between text-xs text-muted tabular-nums">
          <span>{{ formatDateTime(fullDomain[0]) }}</span>
          <span>{{ formatDateTime(fullDomain[1]) }}</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-1.5 px-4 py-3">
        <UButton
          v-for="key in selectedKeys"
          :key="key"
          size="xs"
          color="neutral"
          :variant="hiddenKeys.has(key) ? 'ghost' : 'soft'"
          @click="toggleKey(key)"
        >
          <template #leading>
            <span
              class="size-2 rounded-full"
              :style="{ backgroundColor: signalColor(key), outline: resolveSignal(key).role === 'sp' ? `1px dashed ${signalColor(key)}` : 'none', outlineOffset: '1px' }"
            />
          </template>
          <span :class="hiddenKeys.has(key) ? 'text-dimmed line-through' : 'text-highlighted'">
            {{ resolveSignal(key).label }}
          </span>
          <span v-if="resolveSignal(key).unit" class="text-dimmed">{{ resolveSignal(key).unit }}</span>
        </UButton>
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
