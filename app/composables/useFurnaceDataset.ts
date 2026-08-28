import { computed } from 'vue'
import useUploadedFile from '~/composables/useUploadedFile'
import useFurnaceData from '~/composables/useFurnaceData'
import { formatRangeShort } from '~/utils/format'

/**
 * Bindeglied zwischen der in IndexedDB gehaltenen CSV (`useUploadedFile`) und der
 * Datenschicht (`useFurnaceData`). Lädt beim Mounten den gespeicherten Stand und
 * parst streamend neu — mit Fortschritt, auch für sehr große Dateien.
 */
export default function useFurnaceDataset() {
  const upload = useUploadedFile('dataset')
  const data = useFurnaceData()

  const parsing = useState<boolean>('furnace-dataset-parsing', () => false)
  const progress = useState<number>('furnace-dataset-progress', () => 0)
  const stage = useState<'reading' | 'parsing' | null>('furnace-dataset-stage', () => null)

  async function reparse() {
    const blob = await upload.getBlob()
    if (!blob) {
      data.reset()
      return
    }
    parsing.value = true
    progress.value = 0
    stage.value = 'reading'
    // Kurz yield, damit der Fortschrittsbalken zeichnet, bevor der Parser läuft.
    await new Promise(resolve => setTimeout(resolve, 16))
    try {
      await data.load(blob, (p) => {
        stage.value = p.stage
        if (Math.abs(p.fraction - progress.value) > 0.004 || p.fraction >= 1) {
          progress.value = p.fraction
        }
      })
      progress.value = 1
    } finally {
      parsing.value = false
      stage.value = null
    }
  }

  async function init() {
    await upload.loadFromStorage()
    await reparse()
  }

  async function setFile(file: File) {
    await upload.setFile(file)
    await reparse()
  }

  async function clear() {
    await upload.clear()
    data.reset()
    progress.value = 0
  }

  const modeLabel = computed(() => {
    if (!data.ready.value) return null
    return data.isAnalysis.value ? 'Prozessdaten + Modellergebnisse' : 'Prozessdaten'
  })

  const summary = computed(() => {
    if (!data.ready.value || !data.timeRange.value) return null
    const [from, to] = data.timeRange.value
    return {
      range: formatRangeShort(from, to),
      rows: data.rowCount.value,
      sourceRows: data.sourceRows.value,
      decimated: data.decimated.value,
      mode: modeLabel.value
    }
  })

  return {
    fileMeta: upload.fileMeta,
    hasFile: upload.hasFile,
    parsing,
    progress,
    stage,
    ready: data.ready,
    parseError: data.parseError,
    summary,
    modeLabel,
    init,
    setFile,
    clear
  }
}
