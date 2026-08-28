import { computed, watch } from 'vue'
import useFurnaceData, { type ModelKey, type PhaseKey } from '~/composables/useFurnaceData'
import useChartInteraction from '~/composables/useChartInteraction'
import { defaultSignals, SIGNALS } from '~/utils/signals'

export type PhaseSelection = PhaseKey | 'all'

interface SelectionState {
  model: ModelKey | null
  zone: number | null
  phase: PhaseSelection
  signals: string[]
}

const STORAGE_KEY = 'furnaceSelection'

function createDefaultState(): SelectionState {
  return { model: null, zone: null, phase: 'all', signals: [] }
}

/**
 * Auswahl von Modell, Zone, Phase und Signalen — geteilt zwischen Sidebar und
 * Hauptbereich. Wird gegen die geladene Datei abgeglichen (Claude.md §5) und in
 * localStorage gehalten. Ein Wechsel von Modell, Zone oder Phase setzt Zoom und
 * Ereignisauswahl zurück (§7).
 */
export default function useFurnaceSelection() {
  const state = useState<SelectionState>('furnace-selection', createDefaultState)
  const hydrated = useState<boolean>('furnace-selection-hydrated', () => false)

  const {
    ready,
    zones,
    models,
    populatedPhases,
    availableSignalKeys,
    hasPhases
  } = useFurnaceData()
  const chart = useChartInteraction()

  function persist() {
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
    }
  }

  function hydrate() {
    if (!import.meta.client || hydrated.value) return
    hydrated.value = true
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Partial<SelectionState>
      state.value = { ...createDefaultState(), ...parsed }
    } catch {
      /* defekten Stand ignorieren */
    }
  }

  function signalsForKeys(zone: number): string[] {
    const wanted = defaultSignals(zone).filter(key => availableSignalKeys.value.has(key))
    if (wanted.length) return wanted
    // Fallback: erste vorhandene Signale dieser Zone aus dem Katalog.
    return SIGNALS
      .filter(sig => sig.zone === zone && availableSignalKeys.value.has(sig.key))
      .slice(0, 3)
      .map(sig => sig.key)
  }

  /** Auswahl mit den Möglichkeiten der geladenen Datei in Einklang bringen. */
  function reconcile() {
    if (!ready.value) return
    const next = { ...state.value }
    let changed = false

    if (next.zone == null || !zones.value.includes(next.zone)) {
      next.zone = zones.value[0] ?? null
      changed = true
    }

    if (models.value.length === 0) {
      if (next.model !== null) {
        next.model = null
        changed = true
      }
    } else if (next.model == null || !models.value.includes(next.model)) {
      next.model = models.value[0]!
      changed = true
    }

    if (next.phase !== 'all' && (!hasPhases.value || !populatedPhases.value.has(next.phase))) {
      next.phase = 'all'
      changed = true
    }

    const keptSignals = next.signals.filter(key => availableSignalKeys.value.has(key))
    if (keptSignals.length !== next.signals.length) {
      next.signals = keptSignals
      changed = true
    }
    if (!next.signals.length && next.zone != null) {
      next.signals = signalsForKeys(next.zone)
      changed = true
    }

    if (changed) {
      state.value = next
      persist()
    }
  }

  watch(
    [ready, zones, models, populatedPhases, availableSignalKeys],
    () => reconcile(),
    { immediate: true, deep: true }
  )

  // ---- Setter -------------------------------------------------------- //

  const model = computed<ModelKey | null>({
    get: () => state.value.model,
    set: (value) => {
      state.value = { ...state.value, model: value }
      persist()
      chart.reset()
    }
  })

  const zone = computed<number | null>({
    get: () => state.value.zone,
    set: (value) => {
      const prev = state.value.zone
      let signals = state.value.signals
      if (prev != null && value != null && prev !== value) {
        signals = signals
          .map(key => key.replace(`z${prev}_`, `z${value}_`))
          .filter(key => availableSignalKeys.value.has(key))
        if (!signals.length) signals = signalsForKeys(value)
      }
      state.value = { ...state.value, zone: value, signals }
      persist()
      chart.reset()
    }
  })

  const phase = computed<PhaseSelection>({
    get: () => state.value.phase,
    set: (value) => {
      state.value = { ...state.value, phase: value }
      persist()
      chart.reset()
    }
  })

  const signals = computed<string[]>({
    get: () => state.value.signals,
    set: (value) => {
      state.value = { ...state.value, signals: value }
      persist()
    }
  })

  function setDefaultSignals() {
    if (state.value.zone != null) {
      signals.value = signalsForKeys(state.value.zone)
    }
  }

  /** Zeitfenster-Filter für series()/kpis(): Phase (außer 'all') weiterreichen. */
  const rowFilter = computed(() => ({
    phase: state.value.phase === 'all' ? null : state.value.phase
  }))

  return {
    model,
    zone,
    phase,
    signals,
    rowFilter,
    hydrate,
    reconcile,
    setDefaultSignals
  }
}
