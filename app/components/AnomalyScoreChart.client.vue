<script setup lang="ts">
import { format } from 'date-fns'
import { VisAxis, VisCrosshair, VisLine, VisScatter, VisTooltip, VisXYContainer } from '@unovis/vue'

type ScoreRow = { time: number, score: number }

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)

const { scorePoints, events, kind } = useAnomalyResults()
const { zoomDomain } = useChartInteraction()

const lineData = computed<ScoreRow[]>(() =>
  scorePoints.value.map(point => ({ time: point.time.getTime(), score: point.score }))
)

const eventScoreData = computed<ScoreRow[]>(() =>
  events.value
    .filter(event => event.scoreNormalized !== null || event.scoreRaw !== null)
    .map(event => ({ time: event.centerTime.getTime(), score: (event.scoreNormalized ?? event.scoreRaw)! }))
)

const hasContinuousScore = computed(() => kind.value === 'points' && lineData.value.length > 0)
const hasEventScore = computed(() => kind.value === 'events' && eventScoreData.value.length > 0)
const hasAnyScore = computed(() => hasContinuousScore.value || hasEventScore.value)

const xDomain = computed<[number, number] | undefined>(() => zoomDomain.value ?? undefined)

function xTickFormat(value: number): string {
  return Number.isFinite(value) ? format(new Date(value), 'HH:mm:ss') : ''
}
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'px-0! pt-0! pb-3!' }">
    <template #header>
      <p class="font-semibold text-highlighted">
        Anomaly Score
      </p>
    </template>

    <div v-if="!hasAnyScore" class="flex h-72 items-center justify-center px-6 text-center text-sm text-muted">
      Upload an anomaly results CSV to see the score over time.
    </div>

    <VisXYContainer
      v-else-if="hasContinuousScore"
      :data="lineData"
      :x-domain="xDomain"
      :padding="{ top: 20 }"
      :margin="{ left: -5, right: -5 }"
      class="h-72"
      :width="width"
    >
      <VisLine :x="(d: ScoreRow) => d.time" :y="(d: ScoreRow) => d.score" color="var(--ui-primary)" />
      <VisAxis type="x" :x="(d: ScoreRow) => d.time" :tick-format="xTickFormat" />
      <VisAxis type="y" />
      <VisCrosshair color="var(--ui-primary)" />
      <VisTooltip />
    </VisXYContainer>

    <VisXYContainer
      v-else
      :data="eventScoreData"
      :x-domain="xDomain"
      :padding="{ top: 20 }"
      :margin="{ left: -5, right: -5 }"
      class="h-72"
      :width="width"
    >
      <VisScatter :x="(d: ScoreRow) => d.time" :y="(d: ScoreRow) => d.score" color="var(--ui-primary)" />
      <VisAxis type="x" :x="(d: ScoreRow) => d.time" :tick-format="xTickFormat" />
      <VisAxis type="y" />
      <VisTooltip />
    </VisXYContainer>
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
</style>
