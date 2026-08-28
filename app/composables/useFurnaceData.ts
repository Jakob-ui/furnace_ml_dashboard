/**
 * Datenschicht für das Stoßofen-Dashboard (Claude.md §9).
 *
 * Die CSV wird einmal spaltenweise in `Float64Array` geparst. Danach kostet ein
 * Wechsel von Zone, Phase oder Signal keine erneute Parsung — `series()`,
 * `scoreSeries()` und `kpis()` arbeiten auf den geparsten Spalten.
 *
 * Zwei Betriebsarten, erkannt an den Spalten:
 *  · Prozessmodus  — nur Prozessdaten
 *  · Analysemodus  — zusätzlich `score_<modell>_z<N>` und/oder `flag_<modell>_z<N>`
 *
 * Zustand ist modulweit (Singleton), damit Sidebar und Panels dieselbe geparste
 * Datei sehen. `shallowRef` für die Rohdaten — keine tiefen reaktiven Kopien.
 */
import { computed, shallowRef, triggerRef } from 'vue'
import { formatIsoLocal } from '~/utils/format'

// --------------------------------------------------------------------------- //
// Typen
// --------------------------------------------------------------------------- //

export type ModelKey = 'svm' | 'iforest' | 'autoencoder'

export const MODEL_LABELS: Record<ModelKey, string> = {
  svm: 'One-Class SVM',
  iforest: 'Isolation Forest',
  autoencoder: 'Autoencoder'
}

export type PhaseKey = 'heating' | 'hold' | 'cooling'

export const PHASE_LABELS: Record<PhaseKey, string> = {
  heating: 'Aufheizen',
  hold: 'Halten',
  cooling: 'Abkühlen'
}

export interface RowFilter {
  phase?: PhaseKey | 'all' | null
  cycle?: number | null
  from?: number | null
  to?: number | null
}

export interface SeriesOptions extends RowFilter {
  maxPoints?: number
}

export type SeriesPoint = { x: number } & Record<string, number>

export interface FurnaceEvent {
  id: string
  model: ModelKey
  zone: number
  start: number
  end: number
  durationSeconds: number
  /** Repräsentative Phase (häufigste innerhalb des Ereignisses), falls vorhanden. */
  phase: PhaseKey | null
  /** Repräsentativer Zyklus, falls vorhanden. */
  cycle: number | null
  /** Höchster Score im Ereignis (nur wenn score_-Spalten vorhanden). */
  peakScore: number | null
}

export interface Kpis {
  totalEvents: number
  /** Anteil anomaler Zeilen in Prozent (0…100). */
  anomalyRatio: number
  anomalySeconds: number
}

export interface ParseProgress {
  /** `reading` = Datei einlesen/zählen, `parsing` = Spalten füllen. */
  stage: 'reading' | 'parsing'
  /** Gesamtfortschritt 0…1. */
  fraction: number
  /** Bereits übernommene Zeilen (nur in der `parsing`-Phase). */
  rows: number
}

/**
 * Obergrenze an Zeilen, die im Speicher gehalten werden. Größere Dateien werden
 * beim Einlesen gleichmäßig ausgedünnt — sonst sprengt ein Mehr-hundert-MB-Auszug
 * den Browser-Speicher (110 Spalten × Float64Array).
 */
const MAX_ROWS = 800_000

// --------------------------------------------------------------------------- //
// Modulweiter Zustand
// --------------------------------------------------------------------------- //

const PHASE_CODE: Record<string, number> = { heating: 1, hold: 2, cooling: 3 }
const PHASE_BY_CODE: Record<number, PhaseKey> = { 1: 'heating', 2: 'hold', 3: 'cooling' }

interface ParsedTable {
  time: Float64Array
  columns: string[]
  data: Record<string, Float64Array>
  phase: Int8Array | null
  cycle: Float64Array | null
  rowCount: number
  /** Zeilen in der Datei vor dem Ausdünnen. */
  sourceRows: number
  /** Ausdünnfaktor; 1 = alle Zeilen übernommen. */
  stride: number
}

const table = shallowRef<ParsedTable | null>(null)
const externalEvents = shallowRef<FurnaceEvent[] | null>(null)
const parseError = shallowRef<string | null>(null)

// Raw-IBA-Spaltennamen -> Katalogschlüssel (falls versehentlich der Rohexport
// hochgeladen wird). Nur so viel, dass Zone/Signalauswahl funktionieren.
const RAW_SUFFIX_MAP: Record<string, string> = {
  'heating controller setpoint': 'temp_sp',
  'heating controller process value': 'temp_pv',
  'heating controller controller manipulated variable': 'temp_mv',
  'temperature detection wind ahead of charge sp': 'wind_ahead_sp',
  'temperature detection wind ahead of charge pv': 'wind_ahead_pv',
  'temperature detection wind beyond of charge sp': 'wind_beyond_sp',
  'temperature detection wind beyond charge': 'wind_beyond_pv',
  'control error temperature wind ahead of charge': 'err_ahead_err',
  'control error temperature wind beyond of charge': 'err_beyond_err',
  'combustion air controller setpoint': 'air_sp',
  'combustion air controller sepoint': 'air_sp',
  'combustion air controller process value': 'air_pv',
  'combustion air controller controller manipulated variable': 'air_mv',
  'combustion air control flow metering': 'air_flow',
  'fuel gas controller setpoint': 'gas_sp',
  'fuel gas controller process value': 'gas_pv',
  'fuel gas controller controller manipulated variable': 'gas_mv',
  'fuel gas control flow metering': 'gas_flow',
  'combustion air/ fuel gas ratio': 'ratio_ratio'
}

function normalizeColumnName(raw: string): string {
  const n = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (n === 'time' || n === 'cycle' || n === 'phase') return n
  if (/^z\d+_/.test(raw.trim()) || /^x_/.test(raw.trim())) return raw.trim()
  if (/^score_/.test(raw.trim()) || /^flag_/.test(raw.trim())) return raw.trim()
  const zoneMatch = n.match(/^zone (\d+) (.+)$/)
  if (zoneMatch && RAW_SUFFIX_MAP[zoneMatch[2]!]) {
    return `z${Number(zoneMatch[1])}_${RAW_SUFFIX_MAP[zoneMatch[2]!]}`
  }
  return raw.trim()
}

// --------------------------------------------------------------------------- //
// CSV-Parsing (spaltenweise)
// --------------------------------------------------------------------------- //

function detectDelimiter(headerLine: string): ',' | ';' {
  return (headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0) ? ';' : ','
}

function splitLine(line: string, delimiter: string): string[] {
  if (line.indexOf('"') === -1) return line.split(delimiter)
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (ch === delimiter && !quoted) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function parseNumericCell(raw: string): number {
  const v = raw.trim()
  if (!v) return Number.NaN
  // Dezimalkomma tolerieren (versehentlicher Rohexport): '-1,40002' -> -1.40002
  const normalized = v.includes(',') && !v.includes('.') ? v.replace(',', '.') : v
  const n = Number(normalized)
  return Number.isFinite(n) ? n : Number.NaN
}

function fracToMs(frac: string | undefined): number {
  return frac ? Math.round(Number(`0.${frac}`) * 1000) : 0
}

function parseTimeCell(raw: string): number {
  const v = raw.trim()
  if (!v) return Number.NaN

  // Deutsches Rohexport-Format: DD.MM.YYYY HH:MM[:SS[.ffffff]]
  const de = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,](\d{1,6}))?/)
  if (de) {
    const t = new Date(
      Number(de[3]), Number(de[2]) - 1, Number(de[1]),
      Number(de[4]), Number(de[5]), de[6] ? Number(de[6]) : 0, fracToMs(de[7])
    ).getTime()
    return Number.isNaN(t) ? Number.NaN : t
  }

  // ISO 8601 bevorzugt; ' ' statt 'T' tolerieren.
  const iso = v.includes(' ') && !v.includes('T') ? v.replace(' ', 'T') : v
  const t = Date.parse(iso)
  return Number.isNaN(t) ? Number.NaN : t
}

function parsePhaseCell(raw: string): number {
  return PHASE_CODE[raw.trim().toLowerCase()] ?? 0
}

/**
 * Liest ein Blob zeilenweise, streamend. `onChunk` bekommt jeweils die
 * vollständigen Zeilen eines Lesevorgangs plus die bislang gelesenen Bytes.
 * Funktioniert im Browser und in Node (globales `Blob`/`TextDecoder`).
 */
async function streamLines(
  blob: Blob,
  onChunk: (lines: string[], bytesRead: number) => void | Promise<void>
): Promise<void> {
  const reader = blob.stream().getReader() as ReadableStreamDefaultReader<Uint8Array>
  const decoder = new TextDecoder()
  let buffer = ''
  let bytesRead = 0

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    bytesRead += value.byteLength
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    await onChunk(parts, bytesRead)
  }

  buffer += decoder.decode()
  if (buffer.length) await onChunk([buffer], bytesRead)
}

const TIME_ERROR
  = 'Keine Zeile hat einen lesbaren Zeitstempel in der Spalte `time`. '
    + 'Erwartet wird ISO 8601 (2025-10-10T00:03:42) oder ein Rohexport-Zeitstempel (10.10.2025 00:03:42).'

async function parseColumnar(
  source: string | Blob,
  onProgress?: (p: ParseProgress) => void
): Promise<ParsedTable> {
  const blob = typeof source === 'string' ? new Blob([source]) : source
  const totalBytes = blob.size || 1

  // ---- Durchlauf 1: Kopfzeile + Datenzeilen zählen -------------------- //
  let headerLine: string | null = null
  let dataLines = 0
  await streamLines(blob, (lines, bytesRead) => {
    for (const raw of lines) {
      if (headerLine === null) {
        if (raw.trim()) headerLine = raw
        continue
      }
      if (raw.trim()) dataLines++
    }
    onProgress?.({ stage: 'reading', fraction: 0.3 * (bytesRead / totalBytes), rows: 0 })
  })
  if (headerLine === null) throw new Error('Die Datei ist leer.')

  const delimiter = detectDelimiter(headerLine)
  const headers = splitLine(headerLine, delimiter).map(h => normalizeColumnName(h.trim()))
  const timeIdx = headers.indexOf('time')
  if (timeIdx === -1) throw new Error('Spalte `time` fehlt.')
  const phaseIdx = headers.indexOf('phase')
  const cycleIdx = headers.indexOf('cycle')

  const valueIndices: number[] = []
  const valueNames: string[] = []
  const seen = new Set<string>()
  headers.forEach((name, idx) => {
    if (idx === timeIdx || idx === phaseIdx || idx === cycleIdx) return
    if (!name || seen.has(name)) return
    seen.add(name)
    valueIndices.push(idx)
    valueNames.push(name)
  })

  const stride = dataLines > MAX_ROWS ? Math.ceil(dataLines / MAX_ROWS) : 1
  const capacity = Math.ceil(dataLines / stride) + 1

  const time = new Float64Array(capacity)
  const phase = phaseIdx === -1 ? null : new Int8Array(capacity)
  const cycle = cycleIdx === -1 ? null : new Float64Array(capacity)
  const data: Record<string, Float64Array> = {}
  for (const name of valueNames) data[name] = new Float64Array(capacity)

  // ---- Durchlauf 2: Spalten füllen ---------------------------------- //
  let sawHeader = false
  let dataIdx = -1
  let write = 0
  let yieldedAt = 0

  await streamLines(blob, async (lines, bytesRead) => {
    for (const raw of lines) {
      if (!sawHeader) {
        if (raw.trim()) sawHeader = true
        continue
      }
      if (!raw.trim()) continue
      dataIdx++
      if (stride > 1 && dataIdx % stride !== 0) continue
      if (write >= capacity) continue

      const cells = splitLine(raw, delimiter)
      const t = parseTimeCell(cells[timeIdx] ?? '')
      if (Number.isNaN(t)) continue

      time[write] = t
      if (phase) phase[write] = parsePhaseCell(cells[phaseIdx] ?? '')
      if (cycle) cycle[write] = parseNumericCell(cells[cycleIdx] ?? '')
      for (let k = 0; k < valueIndices.length; k++) {
        data[valueNames[k]!]![write] = parseNumericCell(cells[valueIndices[k]!] ?? '')
      }
      write++
    }

    onProgress?.({ stage: 'parsing', fraction: 0.3 + 0.7 * (bytesRead / totalBytes), rows: write })

    // Dem Event-Loop selten Luft geben, damit der Fortschrittsbalken zeichnet.
    if (bytesRead - yieldedAt > 8_000_000) {
      yieldedAt = bytesRead
      await new Promise<void>(resolve => setTimeout(resolve))
    }
  })

  if (write === 0) throw new Error(dataLines > 0 ? TIME_ERROR : 'Keine gültigen Datenzeilen gefunden.')

  const cut = <T extends Float64Array | Int8Array>(arr: T): T =>
    (write === arr.length ? arr : arr.slice(0, write)) as T

  let finalTime = cut(time)
  let finalData = Object.fromEntries(valueNames.map(name => [name, cut(data[name]!)]))
  let finalPhase = phase ? cut(phase) : null
  let finalCycle = cycle ? cut(cycle) : null

  // Nach Zeit sortieren, falls die Datei nicht sortiert ist.
  let sorted = true
  for (let i = 1; i < write; i++) {
    if (finalTime[i]! < finalTime[i - 1]!) {
      sorted = false
      break
    }
  }
  if (!sorted) {
    const order = Array.from({ length: write }, (_, i) => i).sort((a, b) => finalTime[a]! - finalTime[b]!)
    const reindex = <T extends Float64Array | Int8Array>(src: T): T => {
      const dst = src.slice() as T
      for (let i = 0; i < write; i++) dst[i] = src[order[i]!]!
      return dst
    }
    finalTime = reindex(finalTime)
    finalData = Object.fromEntries(valueNames.map(name => [name, reindex(finalData[name]!)]))
    finalPhase = finalPhase ? reindex(finalPhase) : null
    finalCycle = finalCycle ? reindex(finalCycle) : null
  }

  return {
    time: finalTime,
    columns: valueNames,
    data: finalData,
    phase: finalPhase,
    cycle: finalCycle,
    rowCount: write,
    sourceRows: dataLines,
    stride
  }
}

// --------------------------------------------------------------------------- //
// Downsampling — LTTB, Ausreißer bleiben erhalten
// --------------------------------------------------------------------------- //

function lttbIndices(xs: number[], ys: number[], threshold: number): number[] {
  const n = xs.length
  if (threshold >= n || threshold <= 2) return xs.map((_, i) => i)

  const sampled: number[] = [0]
  const bucketSize = (n - 2) / (threshold - 2)
  let a = 0

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n)

    let avgX = 0
    let avgY = 0
    const avgCount = rangeEnd - rangeStart
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgX += xs[j]!
      avgY += ys[j]!
    }
    if (avgCount > 0) {
      avgX /= avgCount
      avgY /= avgCount
    }

    const curRangeStart = Math.floor(i * bucketSize) + 1
    const curRangeEnd = Math.floor((i + 1) * bucketSize) + 1

    const ax = xs[a]!
    const ay = ys[a]!
    let maxArea = -1
    let nextA = curRangeStart
    for (let j = curRangeStart; j < curRangeEnd; j++) {
      const area = Math.abs((ax - avgX) * (ys[j]! - ay) - (ax - xs[j]!) * (avgY - ay))
      if (area > maxArea) {
        maxArea = area
        nextA = j
      }
    }
    sampled.push(nextA)
    a = nextA
  }

  sampled.push(n - 1)
  return sampled
}

// --------------------------------------------------------------------------- //
// Composable
// --------------------------------------------------------------------------- //

export default function useFurnaceData() {
  async function load(
    source: string | Blob,
    onProgress?: (p: ParseProgress) => void
  ): Promise<void> {
    parseError.value = null
    try {
      const parsed = await parseColumnar(source, onProgress)
      table.value = parsed
      externalEvents.value = null
    } catch (err) {
      table.value = null
      parseError.value = err instanceof Error ? err.message : 'Die Datei konnte nicht gelesen werden.'
    }
  }

  /** Optionale separate Ereignistabelle (event_start,event_end,model,zone,…). */
  function loadEvents(csvText: string): void {
    try {
      const lines = csvText.split(/\r?\n/).filter(l => l.trim())
      if (!lines.length) return
      const delimiter = detectDelimiter(lines[0]!)
      const headers = splitLine(lines[0]!, delimiter).map(h => h.trim().toLowerCase())
      const col = (name: string) => headers.indexOf(name)
      const si = col('event_start')
      const ei = col('event_end')
      const mi = col('model')
      const zi = col('zone')
      if (si === -1 || ei === -1) return

      const evs: FurnaceEvent[] = []
      lines.slice(1).forEach((line, idx) => {
        const cells = splitLine(line, delimiter)
        const start = parseTimeCell(cells[si] ?? '')
        const end = parseTimeCell(cells[ei] ?? '')
        if (Number.isNaN(start) || Number.isNaN(end)) return
        const model = (cells[mi]?.trim().toLowerCase() as ModelKey) || 'svm'
        const zone = zi === -1 ? 0 : Math.round(parseNumericCell(cells[zi] ?? '')) || 0
        evs.push({
          id: `ext-${idx}`,
          model,
          zone,
          start,
          end,
          durationSeconds: Math.max(0, (end - start) / 1000),
          phase: null,
          cycle: null,
          peakScore: null
        })
      })
      externalEvents.value = evs
    } catch {
      /* Ereignistabelle ist optional — Fehler hier nicht eskalieren. */
    }
  }

  const ready = computed(() => table.value !== null && table.value.rowCount > 0)
  const rowCount = computed(() => table.value?.rowCount ?? 0)
  const sourceRows = computed(() => table.value?.sourceRows ?? 0)
  const decimated = computed(() => (table.value?.stride ?? 1) > 1)
  const columns = computed(() => table.value?.columns ?? [])
  const availableSignalKeys = computed(() => new Set(columns.value))

  const timeRange = computed<[number, number] | null>(() => {
    const t = table.value
    if (!t || t.rowCount === 0) return null
    return [t.time[0]!, t.time[t.rowCount - 1]!]
  })

  const zones = computed<number[]>(() => {
    const found = new Set<number>()
    for (const name of columns.value) {
      const m = name.match(/^z(\d+)_/)
      if (m) found.add(Number(m[1]))
    }
    return [...found].sort((a, b) => a - b)
  })

  const scoreModelZones = computed(() => {
    const map = new Map<ModelKey, Set<number>>()
    for (const name of columns.value) {
      const m = name.match(/^score_([a-z]+)_z(\d+)$/)
      if (!m) continue
      const model = m[1] as ModelKey
      if (!map.has(model)) map.set(model, new Set())
      map.get(model)!.add(Number(m[2]))
    }
    return map
  })

  const flagModelZones = computed(() => {
    const map = new Map<ModelKey, Set<number>>()
    for (const name of columns.value) {
      const m = name.match(/^flag_([a-z]+)_z(\d+)$/)
      if (!m) continue
      const model = m[1] as ModelKey
      if (!map.has(model)) map.set(model, new Set())
      map.get(model)!.add(Number(m[2]))
    }
    return map
  })

  const models = computed<ModelKey[]>(() => {
    const found = new Set<ModelKey>()
    for (const key of scoreModelZones.value.keys()) found.add(key)
    for (const key of flagModelZones.value.keys()) found.add(key)
    const priority: ModelKey[] = ['svm', 'iforest', 'autoencoder']
    return [...found].sort((a, b) => priority.indexOf(a) - priority.indexOf(b))
  })

  const hasScores = computed(() => scoreModelZones.value.size > 0)
  const hasFlags = computed(() => flagModelZones.value.size > 0)
  const isAnalysis = computed(() => hasScores.value || hasFlags.value)
  const hasPhases = computed(() => table.value?.phase != null)
  const hasCycles = computed(() => table.value?.cycle != null)

  const cycles = computed<number[]>(() => {
    const c = table.value?.cycle
    if (!c) return []
    const found = new Set<number>()
    for (let i = 0; i < c.length; i++) {
      if (!Number.isNaN(c[i]!)) found.add(c[i]!)
    }
    return [...found].sort((a, b) => a - b)
  })

  /** Welche Phasen kommen tatsächlich vor (für das Deaktivieren leerer Optionen). */
  const populatedPhases = computed<Set<PhaseKey>>(() => {
    const out = new Set<PhaseKey>()
    const p = table.value?.phase
    if (!p) return out
    for (let i = 0; i < p.length; i++) {
      const key = PHASE_BY_CODE[p[i]!]
      if (key) out.add(key)
    }
    return out
  })

  // ---- Zeilenauswahl ---------------------------------------------------- //

  function selectRows(filter: RowFilter = {}): number[] {
    const t = table.value
    if (!t) return []
    const { phase, cycle, from, to } = filter
    const phaseCode = phase && phase !== 'all' ? PHASE_CODE[phase] : null

    // Zeitfenster per Binärsuche eingrenzen (time ist sortiert).
    let lo = 0
    let hi = t.rowCount
    if (from != null) {
      let a = 0
      let b = t.rowCount
      while (a < b) {
        const mid = (a + b) >> 1
        if (t.time[mid]! < from) a = mid + 1
        else b = mid
      }
      lo = a
    }
    if (to != null) {
      let a = 0
      let b = t.rowCount
      while (a < b) {
        const mid = (a + b) >> 1
        if (t.time[mid]! <= to) a = mid + 1
        else b = mid
      }
      hi = a
    }

    const out: number[] = []
    for (let i = lo; i < hi; i++) {
      if (phaseCode != null && (!t.phase || t.phase[i] !== phaseCode)) continue
      if (cycle != null && (!t.cycle || t.cycle[i] !== cycle)) continue
      out.push(i)
    }
    return out
  }

  // ---- Serien für den Plot -------------------------------------------- //

  function buildSeries(keys: string[], rows: number[], maxPoints: number): SeriesPoint[] {
    const t = table.value
    if (!t || !keys.length || !rows.length) return []

    const present = keys.filter(key => t.data[key])
    if (!present.length) return []

    // LTTB auf der ersten Serie; Ausreißer aller Serien zusätzlich erzwingen.
    const xs = rows.map(i => t.time[i]!)
    const primary = t.data[present[0]!]!
    const ysPrimary = rows.map(i => primary[i]!)

    const keepSet = new Set<number>(lttbIndices(xs, ysPrimary, Math.min(maxPoints, rows.length)))
    keepSet.add(0)
    keepSet.add(rows.length - 1)

    for (const key of present) {
      const col = t.data[key]!
      let minPos = -1
      let maxPos = -1
      let minVal = Infinity
      let maxVal = -Infinity
      for (let p = 0; p < rows.length; p++) {
        const v = col[rows[p]!]!
        if (Number.isNaN(v)) continue
        if (v < minVal) {
          minVal = v
          minPos = p
        }
        if (v > maxVal) {
          maxVal = v
          maxPos = p
        }
      }
      if (minPos >= 0) keepSet.add(minPos)
      if (maxPos >= 0) keepSet.add(maxPos)
    }

    const keep = [...keepSet].sort((a, b) => a - b)
    return keep.map((p) => {
      const rowIdx = rows[p]!
      const point: SeriesPoint = { x: t.time[rowIdx]! }
      for (const key of present) {
        const v = t.data[key]![rowIdx]!
        point[key] = Number.isNaN(v) ? Number.NaN : v
      }
      return point
    })
  }

  function series(keys: string[], options: SeriesOptions = {}): SeriesPoint[] {
    const { maxPoints = 2000, ...filter } = options
    return buildSeries(keys, selectRows(filter), maxPoints)
  }

  function scoreSeries(model: ModelKey, zone: number, options: SeriesOptions = {}): SeriesPoint[] {
    const { maxPoints = 2000, ...filter } = options
    const key = `score_${model}_z${zone}`
    if (!table.value?.data[key]) return []
    return buildSeries([key], selectRows(filter), maxPoints)
  }

  // ---- Ereignisse aus flag_-Spalten ---------------------------------- //

  const GAP_BRIDGE_MS = 30_000

  function deriveEvents(model: ModelKey, zone: number): FurnaceEvent[] {
    const t = table.value
    if (!t) return []
    const flagKey = `flag_${model}_z${zone}`
    const scoreKey = `score_${model}_z${zone}`
    const flags = t.data[flagKey]
    const scores = t.data[scoreKey]

    // Ohne flag_-Spalte, aber mit score_-Spalte: Score gegen 0,5 schwellen.
    const isAnom = (i: number): boolean => {
      if (flags) return flags[i] === 1
      if (scores) return scores[i]! >= 0.5
      return false
    }
    if (!flags && !scores) return []

    const events: FurnaceEvent[] = []
    let runStart = -1
    let lastAnom = -1

    const flush = (endRow: number) => {
      if (runStart < 0) return
      const start = t.time[runStart]!
      const end = t.time[endRow]!
      const phaseCounts: Record<number, number> = {}
      const cycleCounts: Record<number, number> = {}
      let peak = scores ? 0 : null
      for (let i = runStart; i <= endRow; i++) {
        if (t.phase) phaseCounts[t.phase[i]!] = (phaseCounts[t.phase[i]!] ?? 0) + 1
        if (t.cycle && !Number.isNaN(t.cycle[i]!)) {
          cycleCounts[t.cycle[i]!] = (cycleCounts[t.cycle[i]!] ?? 0) + 1
        }
        if (scores && scores[i]! > (peak as number)) peak = scores[i]!
      }
      const topPhaseCode = Number(
        Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
      )
      const topCycle = Object.entries(cycleCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
      events.push({
        id: `${model}-z${zone}-${runStart}`,
        model,
        zone,
        start,
        end,
        durationSeconds: Math.max(0, (end - start) / 1000),
        phase: PHASE_BY_CODE[topPhaseCode] ?? null,
        cycle: topCycle != null ? Number(topCycle) : null,
        peakScore: peak
      })
      runStart = -1
      lastAnom = -1
    }

    for (let i = 0; i < t.rowCount; i++) {
      if (isAnom(i)) {
        if (runStart < 0) runStart = i
        else if (t.time[i]! - t.time[lastAnom]! > GAP_BRIDGE_MS) {
          flush(lastAnom)
          runStart = i
        }
        lastAnom = i
      }
    }
    if (runStart >= 0) flush(lastAnom)
    return events
  }

  const eventCache = new Map<string, FurnaceEvent[]>()
  let cacheToken: ParsedTable | null = null

  function allEvents(model: ModelKey, zone: number): FurnaceEvent[] {
    if (externalEvents.value) {
      return externalEvents.value.filter(e => e.model === model && (!e.zone || e.zone === zone))
    }
    if (cacheToken !== table.value) {
      eventCache.clear()
      cacheToken = table.value
    }
    const key = `${model}-${zone}`
    if (!eventCache.has(key)) eventCache.set(key, deriveEvents(model, zone))
    return eventCache.get(key)!
  }

  function eventsFor(model: ModelKey, zone: number, filter: RowFilter = {}): FurnaceEvent[] {
    const { phase, cycle, from, to } = filter
    return allEvents(model, zone).filter((e) => {
      if (phase && phase !== 'all' && e.phase !== phase) return false
      if (cycle != null && e.cycle !== cycle) return false
      if (from != null && e.end < from) return false
      if (to != null && e.start > to) return false
      return true
    })
  }

  /** Geschätzter Schwellwert: kleinster Score einer geflaggten Zeile, sonst 0,5. */
  function flagThreshold(model: ModelKey, zone: number): number {
    const t = table.value
    const flags = t?.data[`flag_${model}_z${zone}`]
    const scores = t?.data[`score_${model}_z${zone}`]
    if (!t || !flags || !scores) return 0.5
    let min = Infinity
    for (let i = 0; i < t.rowCount; i++) {
      if (flags[i] === 1 && scores[i]! < min) min = scores[i]!
    }
    return Number.isFinite(min) ? min : 0.5
  }

  /** Zusammenhängende geflaggte Zeitbereiche (für das Streifenband ohne score_). */
  function flagBands(model: ModelKey, zone: number, filter: RowFilter = {}): [number, number][] {
    return eventsFor(model, zone, filter).map(e => [e.start, e.end])
  }

  // ---- KPIs ---------------------------------------------------------- //

  function kpis(model: ModelKey, zone: number, filter: RowFilter = {}): Kpis {
    const t = table.value
    const evs = eventsFor(model, zone, filter)
    const anomalySeconds = evs.reduce((sum, e) => sum + e.durationSeconds, 0)

    let anomalyRatio = 0
    if (t) {
      const rows = selectRows(filter)
      const flagKey = `flag_${model}_z${zone}`
      const scoreKey = `score_${model}_z${zone}`
      const flags = t.data[flagKey]
      const scores = t.data[scoreKey]
      if ((flags || scores) && rows.length) {
        let anom = 0
        for (const i of rows) {
          if (flags ? flags[i] === 1 : scores![i]! >= 0.5) anom++
        }
        anomalyRatio = (anom / rows.length) * 100
      }
    }

    return { totalEvents: evs.length, anomalyRatio, anomalySeconds }
  }

  // ---- Export ------------------------------------------------------- //

  /**
   * Gefilterte Rohzeilen (volle Auflösung, kein LTTB) für den Datenexport.
   * `time` als lokaler ISO-Zeitstempel, `phase` als Text sofern vorhanden,
   * danach je gewähltem Signal eine Spalte. Nicht vorhandene Schlüssel entfallen.
   */
  function exportTable(keys: string[], filter: RowFilter = {}): {
    header: string[]
    rows: (string | number)[][]
  } {
    const t = table.value
    if (!t) return { header: ['time'], rows: [] }
    const present = keys.filter(key => t.data[key])
    const withPhase = t.phase != null
    const idx = selectRows(filter)
    const header = ['time', ...(withPhase ? ['phase'] : []), ...present]
    const rows = idx.map((i) => {
      const row: (string | number)[] = [formatIsoLocal(t.time[i]!)]
      if (withPhase) row.push(PHASE_BY_CODE[t.phase![i]!] ?? '')
      for (const key of present) {
        const v = t.data[key]![i]!
        row.push(Number.isNaN(v) ? '' : v)
      }
      return row
    })
    return { header, rows }
  }

  return {
    // Laden
    load,
    loadEvents,
    reset: () => {
      table.value = null
      externalEvents.value = null
      parseError.value = null
      triggerRef(table)
    },
    // Status
    ready,
    parseError,
    rowCount,
    sourceRows,
    decimated,
    timeRange,
    columns,
    availableSignalKeys,
    // Ableitungen aus den Spalten
    zones,
    models,
    cycles,
    hasPhases,
    hasCycles,
    hasScores,
    hasFlags,
    isAnalysis,
    populatedPhases,
    scoreModelZones,
    flagModelZones,
    // Abfragen
    selectRows,
    series,
    scoreSeries,
    deriveEvents,
    eventsFor,
    flagThreshold,
    flagBands,
    kpis,
    exportTable
  }
}
