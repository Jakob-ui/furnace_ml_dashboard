<script setup lang="ts">
import useFurnaceData, { type FurnaceEvent, PHASE_LABELS } from '~/composables/useFurnaceData'
import { formatDuration, formatNumber, formatRange } from '~/utils/format'

const data = useFurnaceData()
const { isAnalysis } = data
const { model, zone, rowFilter } = useFurnaceSelection()
const { selectedEventId, selectEvent, reset } = useChartInteraction()

type SortKey = 'start' | 'duration' | 'score'
const sort = ref<SortKey>('start')
const sortItems = [
  { label: 'nach Startzeit', value: 'start' },
  { label: 'nach Dauer', value: 'duration' },
  { label: 'nach Score', value: 'score' }
]

const active = computed(() => isAnalysis.value && model.value != null && zone.value != null)

const allEvents = computed<FurnaceEvent[]>(() => {
  if (!active.value) return []
  return data.eventsFor(model.value!, zone.value!, { phase: rowFilter.value.phase })
})

const SHORT_LIMIT = 2

const longEvents = computed(() => {
  const list = allEvents.value.filter(e => e.durationSeconds >= SHORT_LIMIT)
  const sorted = [...list]
  if (sort.value === 'duration') sorted.sort((a, b) => b.durationSeconds - a.durationSeconds)
  else if (sort.value === 'score') sorted.sort((a, b) => (b.peakScore ?? 0) - (a.peakScore ?? 0))
  else sorted.sort((a, b) => a.start - b.start)
  return sorted
})

const shortCount = computed(() => allEvents.value.filter(e => e.durationSeconds < SHORT_LIMIT).length)

function onRowClick(event: FurnaceEvent) {
  if (selectedEventId.value === event.id) reset()
  else selectEvent(event)
}

const listRef = useTemplateRef<HTMLElement | null>('listRef')
watch(selectedEventId, async (id) => {
  if (!id) return
  await nextTick()
  listRef.value?.querySelector(`[data-event-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' })
})

function subtitle(event: FurnaceEvent): string {
  const parts: string[] = []
  if (event.phase) parts.push(PHASE_LABELS[event.phase])
  if (event.cycle != null) parts.push(`Zyklus ${event.cycle}`)
  return parts.join(' · ')
}
</script>

<template>
  <UCard v-if="active" :ui="{ body: 'p-0!' }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <p class="font-semibold text-highlighted">
            Erkannte Events
          </p>
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
            :label="String(allEvents.length)"
          />
        </div>
        <USelectMenu
          v-model="sort"
          :items="sortItems"
          value-key="value"
          :search-input="false"
          size="xs"
          class="w-40"
        />
      </div>
    </template>

    <UEmpty
      v-if="!allEvents.length"
      variant="naked"
      size="sm"
      icon="i-lucide-search-x"
      title="Keine Ereignisse für diese Auswahl."
      class="h-40"
    />

    <div v-else ref="listRef" class="max-h-[420px] divide-y divide-default overflow-y-auto">
      <button
        v-for="event in longEvents"
        :key="event.id"
        :data-event-id="event.id"
        type="button"
        class="flex w-full flex-col gap-1 border-l-2 px-4 py-2.5 text-left transition-colors"
        :class="selectedEventId === event.id
          ? 'border-primary bg-primary/10'
          : 'border-transparent hover:bg-elevated/50'"
        @click="onRowClick(event)"
      >
        <div class="flex items-start justify-between gap-2">
          <span class="text-sm font-medium text-highlighted">{{ formatRange(event.start, event.end) }}</span>
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
            :label="formatDuration(event.durationSeconds)"
          />
        </div>
        <p v-if="subtitle(event) || event.peakScore != null" class="text-xs text-muted">
          <span v-if="subtitle(event)">{{ subtitle(event) }}</span>
          <span v-if="subtitle(event) && event.peakScore != null"> · </span>
          <span v-if="event.peakScore != null">Score {{ formatNumber(event.peakScore) }}</span>
        </p>
      </button>

      <div v-if="shortCount" class="px-4 py-2.5 text-xs text-muted">
        {{ shortCount }} sehr kurze {{ shortCount === 1 ? 'Ereignis' : 'Ereignisse' }} (unter {{ SHORT_LIMIT }} s)
      </div>
    </div>
  </UCard>
</template>
