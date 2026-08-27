<script setup lang="ts">
import { format } from 'date-fns'

const { events } = useAnomalyResults()
const { selection } = useFurnaceSelection()

function downloadEventsCsv() {
  const header = ['start', 'end', 'duration_seconds', 'score_raw', 'score_normalized', 'reason']
  const lines = events.value.map(event => [
    event.start.toISOString(),
    event.end.toISOString(),
    event.durationSeconds.toFixed(1),
    event.scoreRaw ?? '',
    event.scoreNormalized ?? '',
    `"${event.reason.replace(/"/g, '""')}"`
  ].join(','))

  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `furnace-report-zone${selection.value.zone}-${selection.value.phase.toLowerCase()}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`
  link.click()

  URL.revokeObjectURL(url)
}

function printReport() {
  window.print()
}
</script>

<template>
  <UFieldGroup>
    <UButton
      icon="i-lucide-download"
      color="neutral"
      variant="outline"
      label="Export"
      :disabled="!events.length"
      title="Export detected events as CSV"
      @click="downloadEventsCsv"
    />
    <UButton
      icon="i-lucide-printer"
      color="neutral"
      variant="outline"
      title="Print / save report as PDF"
      @click="printReport"
    />
  </UFieldGroup>
</template>
