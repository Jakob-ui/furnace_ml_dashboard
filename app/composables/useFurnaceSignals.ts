import { parseCsv, parseNumber, parseTimestamp } from '~/utils/csv'

export interface SignalRow {
  time: Date
  values: Record<string, number | null>
}

/**
 * Parses the uploaded "process signals" CSV (time + zone signal columns, as
 * described in Issue 1) into typed rows. Shared across components via
 * useState so the CSV is only parsed once per upload.
 */
export default function useFurnaceSignals() {
  const { fileText, hasFile, loadFromStorage, getFileData } = useUploadedFile('signals')

  const rows = useState<SignalRow[]>('furnace-signal-rows', () => [])
  const columns = useState<string[]>('furnace-signal-columns', () => [])

  function parse(text: string) {
    const { headers, rows: rawRows } = parseCsv(text)
    const timeHeader = headers.find(header => header.toLowerCase() === 'time') ?? 'time'
    columns.value = headers.filter(header => header !== timeHeader)

    rows.value = rawRows
      .map((row) => {
        const time = parseTimestamp(row[timeHeader])
        if (!time) return null

        const values: Record<string, number | null> = {}
        for (const column of columns.value) {
          values[column] = parseNumber(row[column])
        }

        return { time, values }
      })
      .filter((row): row is SignalRow => row !== null)
      .sort((a, b) => a.time.getTime() - b.time.getTime())
  }

  async function load() {
    if (!hasFile.value) {
      rows.value = []
      columns.value = []
      return
    }

    const text = fileText.value ?? await getFileData()
    if (!text) {
      rows.value = []
      columns.value = []
      return
    }

    parse(text)
  }

  const timeRange = computed<[Date, Date] | null>(() => {
    if (!rows.value.length) return null
    return [rows.value[0]!.time, rows.value[rows.value.length - 1]!.time]
  })

  onMounted(async () => {
    await loadFromStorage()
    await load()
  })

  watch([hasFile, fileText], load, { flush: 'post' })

  return {
    rows,
    columns,
    timeRange,
    hasFile
  }
}
