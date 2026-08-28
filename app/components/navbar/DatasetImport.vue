<script setup lang="ts">
import useFurnaceDataset from '~/composables/useFurnaceDataset'
import { formatInteger } from '~/utils/format'

const {
  fileMeta,
  hasFile,
  parsing,
  progress,
  stage,
  summary,
  parseError,
  setFile,
  clear
} = useFurnaceDataset()

const open = useState<boolean>('dataset-import-open', () => false)
const file = ref<File | null>(null)
const toast = useToast()

watch(file, async (selected) => {
  if (!selected) return
  try {
    await setFile(selected)
    if (!parseError.value) open.value = false
  } catch (err) {
    toast.add({
      title: 'Import fehlgeschlagen',
      description: err instanceof Error ? err.message : undefined,
      color: 'error'
    })
  } finally {
    file.value = null
  }
})

const percent = computed(() => Math.round((progress.value ?? 0) * 100))
const stageLabel = computed(() =>
  stage.value === 'reading' ? 'Datei wird gelesen' : 'Datensatz wird eingelesen'
)

async function remove() {
  await clear()
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Datensatz importieren"
    description="Eine aufbereitete Ofen-CSV (oder ein Rohexport). Große Dateien werden streamend im Hintergrund eingelesen."
  >
    <UButton
      :icon="hasFile ? 'i-lucide-table-2' : 'i-lucide-upload'"
      :label="hasFile ? (fileMeta?.name ?? 'Datensatz') : 'CSV importieren'"
      color="neutral"
      variant="outline"
      :ui="{ label: 'max-w-[10rem] truncate' }"
    />

    <template #body>
      <div class="flex flex-col gap-4">
        <UAlert
          v-if="parseError"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="parseError"
        />

        <div v-if="parsing" class="flex flex-col gap-2 py-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted">{{ stageLabel }} …</span>
            <span class="text-muted tabular-nums">{{ percent }} %</span>
          </div>
          <UProgress v-model="percent" :max="100" />
        </div>

        <template v-else>
          <div v-if="hasFile && summary" class="flex flex-col gap-1 text-sm">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-file-spreadsheet" class="size-4 shrink-0 text-dimmed" />
              <span class="truncate font-medium text-highlighted">{{ fileMeta?.name }}</span>
            </div>
            <p class="text-muted">
              {{ summary.range }}
            </p>
            <p class="text-muted">
              {{ formatInteger(summary.rows) }} Zeilen
              <span v-if="summary.decimated">
                (aus {{ formatInteger(summary.sourceRows) }} gleichmäßig reduziert)
              </span>
            </p>
            <p class="text-muted">
              {{ summary.mode }}
            </p>
          </div>

          <UFileUpload
            v-model="file"
            accept=".csv,.txt,text/csv,text/plain"
            variant="area"
            icon="i-lucide-file-spreadsheet"
            :label="hasFile ? 'CSV ersetzen' : 'CSV hier ablegen oder auswählen'"
            description="Aufbereiteter Ofenauszug — auch sehr große Dateien"
          />
        </template>
      </div>
    </template>

    <template v-if="hasFile && !parsing" #footer>
      <UButton
        label="Entfernen"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        @click="remove"
      />
    </template>
  </UModal>
</template>
