<script setup lang="ts">
import { onMounted, ref } from 'vue'
import useUploadedFile from '../../composables/useUploadedFile'
import ModeToggle from '../colorMode/modeToggle.vue';

const uploadState = ref(false);
const value = ref(52);
const { fileMeta, hasFile, setFile, loadFromStorage, clear } = useUploadedFile()

const file = ref<File | null>(null);
const open = ref(false);

const toast = useToast();

onMounted(async () => {
    await loadFromStorage()
})

async function handleSubmit() {
    if (!file.value) return

    try {
        await setFile(file.value)

        toast.add({ title: 'CSV uploaded successfully', color: 'success' })
        file.value = null
        open.value = false
    } catch (err: any) {
        toast.add({ title: 'Upload failed', description: err.message, color: 'error' })
    }
}

async function removeDataset() {
    await clear()
    toast.add({ title: 'Dataset removed', color: 'neutral' })
}
</script>

<template>
    <div class="flex gap-5 items-center">
        <div v-if="fileMeta" class="flex gap-2 items-center">
            <p>Dataset:</p>
            <div class="group relative inline-flex items-center">
                <UBadge v-if="fileMeta" size="md" color="neutral" variant="outline" :label="fileMeta?.name" />
                <button
                    type="button"
                    class="absolute -top-2 -right-2 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white shadow group-hover:flex hover:bg-red-600"
                    :title="'Remove dataset'"
                    @click.stop.prevent="removeDataset"
                >
                    ×
                </button>
            </div>
        </div>
        <UPopover>
            <UButton :label="hasFile ? 'Uploaded' : 'Upload'" :disabled="hasFile" color="primary" :variant="!hasFile ? 'solid' : 'outline'"
                icon="i-heroicons-cloud-arrow-up" :icon-position="'left'" />
            <template #content>
                <div class="p-4 flex flex-col gap-3 w-72">
                    <UFileUpload v-model="file" accept=".csv,text/csv" label="Drop your CSV here"
                        description="CSV files only" icon="i-lucide-file-spreadsheet" />

                    <UButton label="Submit" block :disabled="!file" loading-auto @click="handleSubmit" />
                </div>
            </template>
        </UPopover>
        <ModeToggle />
    </div>
</template>