import { parseBoolean, parseCsv, parseNumber, parseTimestamp } from '~/utils/csv'

export interface AnomalyEvent {
  id: string
  modelName: string | null
  start: Date
  end: Date
  centerTime: Date
  scoreRaw: number | null
  scoreNormalized: number | null
  reason: string
  durationSeconds: number
}

export interface AnomalyScorePoint {
  time: Date
  score: number
  isAnom: boolean
}

export type AnomalyResultsKind = 'events' | 'points' | 'none'

/**
 * Upload standard for the "Anomaly results" CSV, based on the exports found
 * in STO_ML_Project/Laila 2/Comparision/*\/model_comparison_results_*:
 *
 * Event-level (preferred): model_name, event_start, event_end, center_time,
 * score_raw, score_normalized, is_anom, hit_known_anomaly, matched_anomaly, reason
 *
 * Point-level (as produced by the earlier per-timestamp exports, e.g.
 * Laila/Old/exports/heating/zone_N_filtered_anomalies.csv): time, score,
 * is_anom, anomaly_group, reason_short / reason, ...
 *
 * `hit_known_anomaly` / `matched_anomaly` and the aggregate known-hit /
 * recall metrics from the old comparison_row.csv are intentionally not
 * parsed here — Issue 2 removes them, since they only made sense against
 * the two manually labelled reference anomalies (A1/A2) from the earlier
 * model comparison phase.
 */
export default function useAnomalyResults() {
  const { fileText, hasFile, loadFromStorage, getFileData } = useUploadedFile('results')

  const events = useState<AnomalyEvent[]>('furnace-anomaly-events', () => [])
  const scorePoints = useState<AnomalyScorePoint[]>('furnace-anomaly-score-points', () => [])
  const kind = useState<AnomalyResultsKind>('furnace-anomaly-kind', () => 'none')

  function deriveEventsFromPoints(rows: Record<string, string>[]): AnomalyEvent[] {
    const groups = new Map<string, Record<string, string>[]>()

    for (const row of rows) {
      if (!parseBoolean(row.is_anom)) continue
      const groupKey = row.anomaly_group?.trim() || row.time
      if (!groupKey) continue
      if (!groups.has(groupKey)) groups.set(groupKey, [])
      groups.get(groupKey)!.push(row)
    }

    return Array.from(groups.entries())
      .map(([groupKey, groupRows], index): AnomalyEvent | null => {
        const times = groupRows
          .map(row => parseTimestamp(row.time))
          .filter((time): time is Date => time !== null)
        if (!times.length) return null

        const start = new Date(Math.min(...times.map(time => time.getTime())))
        const end = new Date(Math.max(...times.map(time => time.getTime())))
        const scores = groupRows
          .map(row => parseNumber(row.score))
          .filter((score): score is number => score !== null)

        return {
          id: `group-${index}-${groupKey}`,
          modelName: null,
          start,
          end,
          centerTime: new Date((start.getTime() + end.getTime()) / 2),
          scoreRaw: scores.length ? Math.min(...scores) : null,
          scoreNormalized: null,
          reason: groupRows[0]?.reason_short || groupRows[0]?.reason || '',
          durationSeconds: Math.max(0, (end.getTime() - start.getTime()) / 1000)
        }
      })
      .filter((event): event is AnomalyEvent => event !== null)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  function parse(text: string) {
    const { headers, rows } = parseCsv(text)
    const lower = headers.map(header => header.toLowerCase())

    if (lower.includes('event_start') && lower.includes('event_end')) {
      kind.value = 'events'

      events.value = rows
        .map((row, index): AnomalyEvent | null => {
          const start = parseTimestamp(row.event_start)
          const end = parseTimestamp(row.event_end) ?? start
          if (!start || !end) return null
          if (row.is_anom !== undefined && !parseBoolean(row.is_anom)) return null

          return {
            id: `event-${index}-${row.event_start}`,
            modelName: row.model_name?.trim() || null,
            start,
            end,
            centerTime: parseTimestamp(row.center_time) ?? new Date((start.getTime() + end.getTime()) / 2),
            scoreRaw: parseNumber(row.score_raw),
            scoreNormalized: parseNumber(row.score_normalized),
            reason: row.reason?.trim() || '',
            durationSeconds: Math.max(0, (end.getTime() - start.getTime()) / 1000)
          }
        })
        .filter((event): event is AnomalyEvent => event !== null)
        .sort((a, b) => a.start.getTime() - b.start.getTime())

      scorePoints.value = []
    } else if (lower.includes('score') && lower.includes('time')) {
      kind.value = 'points'

      scorePoints.value = rows
        .map((row) => {
          const time = parseTimestamp(row.time)
          const score = parseNumber(row.score)
          if (!time || score === null) return null
          return { time, score, isAnom: parseBoolean(row.is_anom) }
        })
        .filter((point): point is AnomalyScorePoint => point !== null)
        .sort((a, b) => a.time.getTime() - b.time.getTime())

      events.value = deriveEventsFromPoints(rows)
    } else {
      kind.value = 'none'
      events.value = []
      scorePoints.value = []
    }
  }

  async function load() {
    if (!hasFile.value) {
      events.value = []
      scorePoints.value = []
      kind.value = 'none'
      return
    }

    const text = fileText.value ?? await getFileData()
    if (!text) {
      events.value = []
      scorePoints.value = []
      kind.value = 'none'
      return
    }

    parse(text)
  }

  onMounted(async () => {
    await loadFromStorage()
    await load()
  })

  watch([hasFile, fileText], load, { flush: 'post' })

  return {
    events,
    scorePoints,
    kind,
    hasFile
  }
}
