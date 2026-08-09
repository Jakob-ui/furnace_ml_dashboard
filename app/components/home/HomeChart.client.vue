<script setup lang="ts">
import { format } from 'date-fns'
import { VisXYContainer, VisLine, VisAxis, VisArea, VisCrosshair, VisTooltip } from '@unovis/vue'
import useUploadedFile from '~/composables/useUploadedFile'

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')

type ChartRecord = {
  date: Date
  label: string
  value: number
}

const { width } = useElementSize(cardRef)
const { fileText, hasFile, loadFromStorage, getFileData } = useUploadedFile()

const data = ref<ChartRecord[]>([])

const x = (_: ChartRecord, i: number) => i
const y = (d: ChartRecord) => d.value

const total = computed(() => data.value.reduce((acc: number, { value }) => acc + value, 0))

const formatNumber = new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format

const formatDate = (date: Date): string => format(date, 'd MMM')

const xTicks = (i: number) => {
  if (i === 0 || i === data.value.length - 1 || !data.value[i]) {
    return ''
  }

  return formatDate(data.value[i].date)
}

const template = (d: ChartRecord) => `${d.label} • ${formatDate(d.date)}: ${formatNumber(d.value)} min`

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

function parseCsv(content: string): ChartRecord[] {
  const rows = content
    .split(/\r?\n/)
    .map(row => row.trim())
    .filter(Boolean)

  if (!rows.length) {
    return []
  }

  const firstRow = rows[0] ?? ''
  const headers = parseCsvLine(firstRow).map(header => header.trim())

  return rows.slice(1).map((row) => {
    const values = parseCsvLine(row)
    const entry = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))

    const start = entry.heating_start_time ? new Date(String(entry.heating_start_time).replace(' ', 'T')) : null
    const end = entry.charging_start_time ? new Date(String(entry.charging_start_time).replace(' ', 'T')) : null
    const value = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0

    return {
      date: start ?? new Date(),
      label: `Zone ${entry.zone ?? '-'} / Cycle ${entry.cycle ?? '-'}`,
      value
    }
  }).filter(record => record.value > 0)
}

async function loadChartData() {
  if (!hasFile.value) {
    data.value = []
    return
  }

  const text = fileText.value ?? await getFileData()

  if (!text) {
    data.value = []
    return
  }

  data.value = parseCsv(text)
}

onMounted(async () => {
  await loadFromStorage()
  await loadChartData()
})

watch([hasFile, fileText], async () => {
  await loadChartData()
}, { flush: 'post' })
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'px-0! pt-0! pb-3!' }">
    <template #header>
      <div>
        <p class="text-xs text-muted uppercase mb-1.5">
          Cycle duration
        </p>
        <p class="text-3xl text-highlighted font-semibold">
          {{ data.length ? formatNumber(total) : '—' }}
        </p>
      </div>
    </template>

    <div v-if="!data.length" class="flex h-96 items-center justify-center px-6 text-center text-sm text-muted">
      Upload a CSV to visualize cycle durations.
    </div>

    <VisXYContainer
      v-else
      :data="data"
      :padding="{ top: 40 }"
      :margin="{ left: -5, right: -5 }"
      class="h-96"
      :width="width"
    >
      <VisLine
        :x="x"
        :y="y"
        color="var(--ui-primary)"
      />
      <VisArea
        :x="x"
        :y="y"
        color="var(--ui-primary)"
        :opacity="0.1"
      />

      <VisAxis
        type="x"
        :x="x"
        :tick-format="xTicks"
      />

      <VisCrosshair
        color="var(--ui-primary)"
        :template="template"
      />

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
