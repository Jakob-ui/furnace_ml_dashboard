<script setup lang="ts">
import { format } from 'date-fns'
import type { AnomalyEvent } from '~/composables/useAnomalyResults'

const { events } = useAnomalyResults()
const { selectedEventId, selectEvent, resetZoom } = useChartInteraction()

function formatTime(date: Date): string {
  return format(date, 'dd.MM. HH:mm:ss')
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${minutes}m ${secs}s`
}

function onRowClick(event: AnomalyEvent) {
  if (selectedEventId.value === event.id) {
    resetZoom()
  } else {
    selectEvent(event)
  }
}
</script>

<template>
  <UCard :ui="{ body: 'p-0 divide-y divide-default' }">
    <template #header>
      <p class="font-semibold text-highlighted">
        Detected Events
      </p>
    </template>

    <div v-if="!events.length" class="flex h-40 items-center justify-center px-6 text-center text-sm text-muted">
      No anomaly results uploaded yet.
    </div>

    <div v-else class="max-h-96 overflow-y-auto">
      <button
        v-for="event in events"
        :key="event.id"
        type="button"
        class="flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors hover:bg-elevated/50"
        :class="selectedEventId === event.id ? 'bg-primary/10' : ''"
        @click="onRowClick(event)"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-highlighted">{{ formatTime(event.start) }} – {{ formatTime(event.end) }}</span>
          <UBadge
            color="error"
            variant="subtle"
            size="sm"
            :label="formatDuration(event.durationSeconds)"
          />
        </div>
        <p v-if="event.reason" class="truncate text-xs text-muted">
          {{ event.reason }}
        </p>
      </button>
    </div>
  </UCard>
</template>
