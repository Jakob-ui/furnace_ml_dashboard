<script setup lang="ts">
const { events, scorePoints, kind, hasFile: hasResults } = useAnomalyResults()
const { timeRange, hasFile: hasSignals } = useFurnaceSignals()

const hasData = computed(() => hasResults.value || hasSignals.value)

const totalEvents = computed(() => events.value.length)

const totalAnomalySeconds = computed(() => events.value.reduce((sum, event) => sum + event.durationSeconds, 0))

// Prefer the exact ratio from per-timestamp data; fall back to
// event-duration / signal-time-range when only event-level data is available.
const anomalyPercentage = computed<number | null>(() => {
  if (kind.value === 'points' && scorePoints.value.length) {
    const anomalousCount = scorePoints.value.filter(point => point.isAnom).length
    return (anomalousCount / scorePoints.value.length) * 100
  }

  if (timeRange.value) {
    const totalRangeSeconds = (timeRange.value[1].getTime() - timeRange.value[0].getTime()) / 1000
    if (totalRangeSeconds > 0) {
      return (totalAnomalySeconds.value / totalRangeSeconds) * 100
    }
  }

  return null
})

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'

  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const secs = Math.round(seconds % 60)

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <UCard :ui="{ body: 'flex flex-col gap-1' }">
      <p class="text-xs text-muted uppercase">
        Total Events
      </p>
      <p class="text-2xl font-semibold text-highlighted">
        {{ hasData ? totalEvents : '—' }}
      </p>
    </UCard>

    <UCard :ui="{ body: 'flex flex-col gap-1' }">
      <p class="text-xs text-muted uppercase">
        Anomaly Percentage
      </p>
      <p class="text-2xl font-semibold text-highlighted">
        {{ anomalyPercentage !== null ? `${anomalyPercentage.toFixed(2)}%` : '—' }}
      </p>
    </UCard>

    <UCard :ui="{ body: 'flex flex-col gap-1' }">
      <p class="text-xs text-muted uppercase">
        Total Anomaly Duration
      </p>
      <p class="text-2xl font-semibold text-highlighted">
        {{ hasData ? formatDuration(totalAnomalySeconds) : '—' }}
      </p>
    </UCard>
  </div>
</template>
