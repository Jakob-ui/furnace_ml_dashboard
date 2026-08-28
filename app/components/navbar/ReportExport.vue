<script setup lang="ts">
import useReportExport from '~/composables/useReportExport'

const { canExport, exportCsv, print } = useReportExport()

const items = computed(() => [
  {
    label: 'Daten als CSV exportieren',
    icon: 'i-lucide-file-down',
    onSelect: () => exportCsv()
  },
  {
    label: 'Drucken / als PDF speichern',
    icon: 'i-lucide-printer',
    onSelect: () => print()
  }
])
</script>

<template>
  <UDropdownMenu :items="items" :disabled="!canExport" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-file-output"
      label="Bericht"
      color="neutral"
      variant="outline"
      :disabled="!canExport"
    />
  </UDropdownMenu>
</template>
