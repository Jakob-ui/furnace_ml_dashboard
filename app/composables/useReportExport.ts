import { computed } from 'vue'
import useFurnaceData, { MODEL_LABELS, PHASE_LABELS } from '~/composables/useFurnaceData'
import useFurnaceSelection from '~/composables/useFurnaceSelection'
import useChartInteraction from '~/composables/useChartInteraction'
import { resolveSignal } from '~/utils/signals'
import { formatIsoLocal, formatRangeShort, formatStamp } from '~/utils/format'

/**
 * Export und Druckansicht (Claude.md §12). Beide geben den aktuellen
 * Filterzustand mit — Modell, Zone, Phase und Zeitfenster —, damit die Ausgabe
 * reproduzierbar ist. Der CSV-Export enthält die gefilterten Rohzeilen in voller
 * Auflösung; das Drucken nutzt `window.print()` mit der Druck-CSS aus `main.css`.
 */
export default function useReportExport() {
  const data = useFurnaceData()
  const { model, zone, phase, signals, rowFilter } = useFurnaceSelection()
  const { xDomain } = useChartInteraction()
  const toast = useToast()

  const canExport = computed(() => data.ready.value)

  /** Signalspalten des Exports: gewählte Signale + Modellspalten der Analyse. */
  const exportKeys = computed<string[]>(() => {
    const keys = [...signals.value]
    if (data.isAnalysis.value && model.value != null && zone.value != null) {
      for (const prefix of ['score', 'flag']) {
        const key = `${prefix}_${model.value}_z${zone.value}`
        if (data.availableSignalKeys.value.has(key)) keys.push(key)
      }
    }
    return keys.filter(key => data.availableSignalKeys.value.has(key))
  })

  function currentFilter() {
    return {
      phase: rowFilter.value.phase,
      from: xDomain.value?.[0] ?? null,
      to: xDomain.value?.[1] ?? null
    }
  }

  function csvCell(value: string | number): string {
    const text = typeof value === 'number' ? String(value).replace('.', ',') : value
    return /[;\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  function exportCsv() {
    if (!canExport.value) return
    const filter = currentFilter()
    const { header, rows } = data.exportTable(exportKeys.value, filter)

    if (!rows.length) {
      toast.add({
        title: 'Nichts zu exportieren',
        description: 'Für die aktuelle Auswahl gibt es keine Zeilen.',
        color: 'warning'
      })
      return
    }

    const now = Date.now()
    const range = data.timeRange.value
    const windowText = filter.from != null && filter.to != null
      ? formatRangeShort(filter.from, filter.to)
      : range
        ? `${formatRangeShort(range[0], range[1])} (voller Bereich)`
        : 'unbekannt'
    const signalLabels = exportKeys.value.map(key => resolveSignal(key).label).join(', ')

    const meta = [
      '# Stoßofen-Anomalieanalyse — Datenexport',
      `# Erzeugt: ${formatIsoLocal(now)}`,
      `# Modell: ${model.value ? MODEL_LABELS[model.value] : '—'}`,
      `# Zone: ${zone.value ?? '—'}`,
      `# Phase: ${phase.value === 'all' ? 'Alle' : PHASE_LABELS[phase.value]}`,
      `# Zeitfenster: ${windowText}`,
      `# Spalten: ${signalLabels || '—'}`,
      `# Zeilen: ${rows.length}`,
      '# Trennzeichen ";", Dezimalkomma'
    ]

    const lines = [
      ...meta.map(line => `${line}\n`),
      `${header.join(';')}\n`,
      ...rows.map(row => `${row.map(csvCell).join(';')}\n`)
    ]

    const blob = new Blob(lines, { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stossofen_export_${model.value ?? 'prozess'}_z${zone.value ?? 'x'}_${formatStamp(now)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    toast.add({
      title: 'Export erstellt',
      description: `${rows.length} Zeilen · ${header.length} Spalten`,
      color: 'success',
      icon: 'i-lucide-file-down'
    })
  }

  function print() {
    if (import.meta.client) window.print()
  }

  return { canExport, exportCsv, print }
}
