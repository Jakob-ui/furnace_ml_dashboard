/** Deutsche Zahlen-, Datums- und Dauerformatierung (Claude.md §6.2). */

const numberFmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
const percentFmt = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const dateTimeFmt = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

const timeFmt = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

const dateFmt = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
})

const dateTimeSecFmt = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

export function formatNumber(value: number, fractionDigits?: number): string {
  if (!Number.isFinite(value)) return '–'
  if (fractionDigits != null) {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(value)
  }
  return numberFmt.format(value)
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '–'
  return `${percentFmt.format(value)} %`
}

export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return '–'
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value)
}

/** `42 s` · `3 min 22 s` · `1 h 04 min` */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '–'
  const total = Math.round(seconds)
  if (total < 60) return `${total} s`
  const minutes = Math.floor(total / 60)
  if (minutes < 60) {
    const rest = total % 60
    return `${minutes} min ${rest} s`
  }
  const hours = Math.floor(minutes / 60)
  const restMin = minutes % 60
  return `${hours} h ${String(restMin).padStart(2, '0')} min`
}

export function formatDateTime(ms: number): string {
  if (!Number.isFinite(ms)) return '–'
  return dateTimeFmt.format(new Date(ms))
}

export function formatClock(ms: number): string {
  if (!Number.isFinite(ms)) return '–'
  return timeFmt.format(new Date(ms))
}

export function formatDate(ms: number): string {
  if (!Number.isFinite(ms)) return '–'
  return dateFmt.format(new Date(ms))
}

/** Zeitraum, Datum nur einmal wenn Beginn und Ende auf denselben Tag fallen. */
export function formatRange(startMs: number, endMs: number): string {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return '–'
  const start = new Date(startMs)
  const end = new Date(endMs)
  const sameDay
    = start.getFullYear() === end.getFullYear()
      && start.getMonth() === end.getMonth()
      && start.getDate() === end.getDate()
  if (sameDay) {
    return `${dateFmt.format(start)}, ${timeFmt.format(start)} – ${timeFmt.format(end)}`
  }
  return `${dateTimeSecFmt.format(start)} – ${dateTimeSecFmt.format(end)}`
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

/**
 * Lokaler Zeitstempel `YYYY-MM-DD HH:MM:SS` für den Datenexport — vom CSV-Parser
 * wieder einlesbar (er ersetzt das Leerzeichen durch `T`).
 */
export function formatIsoLocal(ms: number): string {
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return `${date} ${time}`
}

/** Kompakter Zeitstempel `YYYYMMDD-HHMM` für Dateinamen. */
export function formatStamp(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

/** Kurzer Zeitraum ohne Sekunden, für die Datei-Zusammenfassung. */
export function formatRangeShort(startMs: number, endMs: number): string {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return '–'
  const start = new Date(startMs)
  const end = new Date(endMs)
  const sameDay
    = start.getFullYear() === end.getFullYear()
      && start.getMonth() === end.getMonth()
      && start.getDate() === end.getDate()
  if (sameDay) {
    return `${dateFmt.format(start)}, ${timeFmt.format(start).slice(0, 5)} – ${timeFmt.format(end).slice(0, 5)}`
  }
  return `${dateTimeFmt.format(start)} – ${dateTimeFmt.format(end)}`
}
