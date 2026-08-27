export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

function detectDelimiter(sampleLine: string): ',' | ';' {
  const semicolons = (sampleLine.match(/;/g) || []).length
  const commas = (sampleLine.match(/,/g) || []).length
  return semicolons > commas ? ';' : ','
}

function parseLine(line: string, delimiter: string): string[] {
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
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

/**
 * Parses CSV text into headers + row objects. Auto-detects the delimiter
 * (',' vs ';') from the header line, since raw IBA exports use ';' while the
 * model comparison exports from the ML pipeline use ','.
 */
export function parseCsv(content: string): ParsedCsv {
  const lines = content
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)

  if (!lines.length) {
    return { headers: [], rows: [] }
  }

  const delimiter = detectDelimiter(lines[0]!)
  const headers = parseLine(lines[0]!, delimiter).map(header => header.trim())

  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line, delimiter)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])) as Record<string, string>
  })

  return { headers, rows }
}

/** Parses a numeric cell, supporting both '.' and ',' as decimal separator. */
export function parseNumber(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // German-style numbers use ',' as decimal separator and '.' as thousands separator.
  const looksGerman = /,\d{1,3}$/.test(trimmed) && trimmed.includes(',')
  const normalized = looksGerman ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed

  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export function parseBoolean(raw: string | undefined | null): boolean {
  if (!raw) return false
  const normalized = raw.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'wahr' || normalized === 'ja'
}

export function parseTimestamp(raw: string | undefined | null): Date | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const isoLike = trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed
  const date = new Date(isoLike)
  return Number.isNaN(date.getTime()) ? null : date
}
