<script setup lang="ts">
const props = defineProps<{
  slotName: string
  title: string
  description: string
}>()

const { fileMeta, hasFile, setFile, loadFromStorage, clear } = useUploadedFile(props.slotName)

const file = ref<File | null>(null)
const toast = useToast()

onMounted(async () => {
  await loadFromStorage()
})

watch(file, async (selected) => {
  if (!selected) return

  try {
    await setFile(selected)
    toast.add({ title: `${props.title} uploaded`, color: 'success' })
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined
    toast.add({ title: 'Upload failed', description: message, color: 'error' })
  } finally {
    file.value = null
  }
})

async function remove() {
  await clear()
  toast.add({ title: `${props.title} removed`, color: 'neutral' })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <p class="text-sm font-medium text-highlighted">
        {{ title }}
      </p>
      <UBadge
        v-if="hasFile"
        color="success"
        variant="subtle"
        label="Loaded"
        size="sm"
      />
    </div>

    <div v-if="fileMeta" class="flex items-center justify-between gap-2 rounded-md border border-default bg-elevated/50 px-2 py-1.5">
      <span class="truncate text-xs text-muted" :title="fileMeta.name">{{ fileMeta.name }}</span>
      <UButton
        icon="i-lucide-x"
        size="xs"
        color="neutral"
        variant="ghost"
        :title="`Remove ${title.toLowerCase()}`"
        @click="remove"
      />
    </div>

    <UFileUpload
      v-else
      v-model="file"
      accept=".csv,text/csv"
      :description="description"
      icon="i-lucide-file-spreadsheet"
      size="sm"
    />
  </div>
</template>
