/**
 * Signalkatalog — generiert aus dem Spaltenvertrag (Claude.md §2.3).
 *
 * Diese Datei ist ein Build-Artefakt. Beschriftungen und Einheiten stehen in den
 * Tabellen `GROUP_META` / `ROLE_LABELS`; der Rest (`SIGNALS`, `SIGNAL_BY_KEY`,
 * `signalsForZone`) wird daraus erzeugt. Nicht einzelne Einträge von Hand pflegen
 * — Tabellen anpassen, dann leitet sich alles konsistent ab.
 *
 * Schlüsselschema: `z<Zone>_<Gruppe>_<Rolle>`  (z. B. `z1_temp_pv`)
 * Je Zone 18 Signale, sechs Zonen -> 108 Prozesssignale.
 */

export type SignalRole = 'sp' | 'pv' | 'mv' | 'flow' | 'err' | 'ratio'

export interface SignalDef {
  /** Spaltenschlüssel wie in `furnace_dashboard.csv`, z. B. `z1_temp_pv`. */
  key: string
  /** Zonennummer 1…6, oder `null` für zonenlose `x_*`-Signale. */
  zone: number | null
  /** Gruppe, z. B. `temp`, `air`, `gas`. */
  group: string
  /** Rolle innerhalb der Gruppe. */
  role: SignalRole
  /** Physikalische Einheit, leer bei dimensionslosen Größen. */
  unit: string
  /** Deutsche Beschriftung für Auswahl und Legende. */
  label: string
}

interface RoleMeta {
  role: SignalRole
  unit: string
}

interface GroupMeta {
  /** Kurzbezeichnung für die Gruppenüberschrift in der Signalauswahl. */
  label: string
  /** Präfix der Signalbeschriftung; Rolle und Zonennummer werden angehängt. */
  signalPrefix: string
  roles: RoleMeta[]
}

/** Beschriftung je Rolle (fließt in `label` ein). */
export const ROLE_LABELS: Record<SignalRole, string> = {
  sp: 'Sollwert',
  pv: 'Istwert',
  mv: 'Stellgröße',
  flow: 'Durchfluss',
  err: 'Regelfehler',
  ratio: 'Verhältnis'
}

/**
 * Gruppen in Anzeigereihenfolge. Reihenfolge hier == Reihenfolge in der
 * gruppierten Signalauswahl.
 */
const GROUP_META: Record<string, GroupMeta> = {
  temp: {
    label: 'Temperaturregelung',
    signalPrefix: 'Temperatur PID',
    roles: [
      { role: 'sp', unit: '°C' },
      { role: 'pv', unit: '°C' },
      { role: 'mv', unit: '%' }
    ]
  },
  wind_ahead: {
    label: 'Vorluft',
    signalPrefix: 'Vorluft',
    roles: [
      { role: 'sp', unit: '°C' },
      { role: 'pv', unit: '°C' }
    ]
  },
  wind_beyond: {
    label: 'Rückluft',
    signalPrefix: 'Rückluft',
    roles: [
      { role: 'sp', unit: '°C' },
      { role: 'pv', unit: '°C' }
    ]
  },
  err_ahead: {
    label: 'Regelfehler Vorluft',
    signalPrefix: 'Regelfehler Vorluft',
    roles: [{ role: 'err', unit: '°C' }]
  },
  err_beyond: {
    label: 'Regelfehler Rückluft',
    signalPrefix: 'Regelfehler Rückluft',
    roles: [{ role: 'err', unit: '°C' }]
  },
  air: {
    label: 'Verbrennungsluft',
    signalPrefix: 'Verbrennungsluft',
    roles: [
      { role: 'sp', unit: '%' },
      { role: 'pv', unit: '%' },
      { role: 'mv', unit: '%' },
      { role: 'flow', unit: 'Nm³/h' }
    ]
  },
  gas: {
    label: 'Brenngas',
    signalPrefix: 'Brenngas',
    roles: [
      { role: 'sp', unit: '%' },
      { role: 'pv', unit: '%' },
      { role: 'mv', unit: '%' },
      { role: 'flow', unit: 'Nm³/h' }
    ]
  },
  ratio: {
    label: 'Luft/Gas-Verhältnis',
    signalPrefix: 'Luft/Gas-Verhältnis',
    roles: [{ role: 'ratio', unit: '' }]
  }
}

export const GROUP_ORDER: string[] = Object.keys(GROUP_META)

/** Gruppenschlüssel -> deutsche Überschrift. */
export const GROUP_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(GROUP_META).map(([key, meta]) => [key, meta.label])
)

export const ZONES: number[] = [1, 2, 3, 4, 5, 6]

function buildSignalLabel(meta: GroupMeta, role: SignalRole, zone: number): string {
  // Für Regelfehler und Verhältnis ist die Rolle bereits im Präfix enthalten.
  if (role === 'err' || role === 'ratio') return `${meta.signalPrefix} ${zone}`
  return `${meta.signalPrefix} ${ROLE_LABELS[role]} ${zone}`
}

function buildSignals(): SignalDef[] {
  const out: SignalDef[] = []
  for (const zone of ZONES) {
    for (const group of GROUP_ORDER) {
      const meta = GROUP_META[group]!
      for (const { role, unit } of meta.roles) {
        out.push({
          key: `z${zone}_${group}_${role}`,
          zone,
          group,
          role,
          unit,
          label: buildSignalLabel(meta, role, zone)
        })
      }
    }
  }
  return out
}

/** Alle 108 Prozesssignale, nach Zone und Anzeigereihenfolge sortiert. */
export const SIGNALS: SignalDef[] = buildSignals()

/** Schneller Zugriff per Schlüssel. */
export const SIGNAL_BY_KEY: Record<string, SignalDef> = Object.fromEntries(
  SIGNALS.map(signal => [signal.key, signal])
)

/** Einheitliche Palette; Zuordnung erfolgt stabil je Signalschlüssel. */
export const SIGNAL_PALETTE: string[] = [
  '#2563eb', // blau
  '#16a34a', // grün
  '#d97706', // amber
  '#9333ea', // violett
  '#db2777', // pink
  '#0d9488', // teal
  '#dc2626', // rot
  '#65a30d', // limette
  '#0891b2', // cyan
  '#c026d3' // magenta
]

/** Deterministische Farbe je Signalschlüssel (zonenunabhängig stabil). */
export function signalColor(key: string): string {
  const withoutZone = key.replace(/^z\d+_/, '')
  let hash = 0
  for (let i = 0; i < withoutZone.length; i++) {
    hash = (hash * 31 + withoutZone.charCodeAt(i)) | 0
  }
  return SIGNAL_PALETTE[Math.abs(hash) % SIGNAL_PALETTE.length]!
}

export interface SignalSelectEntry {
  /** `'label'` markiert eine Gruppenüberschrift (Nuxt UI 4). */
  type?: 'label'
  label: string
  value?: string
  /** Einheit, für die Anzeige im Auswahlmenü. */
  suffix?: string
  group?: string
}

/**
 * Signale einer Zone, gruppiert für `USelectMenu` (Nuxt UI 4): Array von Arrays,
 * jede Gruppe beginnt mit `{ type: 'label' }`. Mit `multiple` + `value-key="value"`
 * verwenden.
 */
export function signalsForZone(zone: number): SignalSelectEntry[][] {
  return GROUP_ORDER.map((group) => {
    const entries: SignalSelectEntry[] = [{ type: 'label', label: GROUP_LABELS[group]! }]
    for (const signal of SIGNALS) {
      if (signal.zone !== zone || signal.group !== group) continue
      entries.push({
        label: signal.label,
        value: signal.key,
        suffix: signal.unit,
        group
      })
    }
    return entries
  }).filter(group => group.length > 1)
}

/**
 * Standardauswahl je Zone: Sollwert, Istwert und Stellgröße der
 * Temperaturregelung — das, worauf die Modelle arbeiten.
 */
export function defaultSignals(zone: number): string[] {
  return [`z${zone}_temp_sp`, `z${zone}_temp_pv`, `z${zone}_temp_mv`]
}

/**
 * SignalDef zu einem beliebigen Spaltenschlüssel — auch für `x_*`-Signale, die
 * nicht im festen Katalog stehen. Unbekannte Schlüssel bekommen einen neutralen
 * Fallback statt `undefined`.
 */
export function resolveSignal(key: string): SignalDef {
  const known = SIGNAL_BY_KEY[key]
  if (known) return known

  const xMatch = key.match(/^x_(.+)$/)
  if (xMatch) {
    return {
      key,
      zone: null,
      group: 'x',
      role: 'pv',
      unit: '',
      label: xMatch[1]!.replace(/_/g, ' ')
    }
  }

  return { key, zone: null, group: 'unbekannt', role: 'pv', unit: '', label: key }
}
