import type { ModelKey, Phase, Zone } from '~/types/furnace'
import { getZoneSignals } from '~/types/furnace'

const STORAGE_KEY = 'furnaceSelection'

interface SelectionState {
  model: ModelKey
  zone: Zone
  phase: Phase
  signals: string[]
}

function defaultSignals(zone: Zone): string[] {
  // Sensible default so the temperature graph isn't empty before the user picks signals.
  return getZoneSignals(zone).slice(0, 2).map(signal => signal.key)
}

function createDefaultState(): SelectionState {
  return {
    model: 'svm',
    zone: 1,
    phase: 'HEATING',
    signals: defaultSignals(1)
  }
}

/**
 * Global model / zone / phase / signal selection, shared between the sidebar
 * controls and the main dashboard. Persisted to localStorage so the choice
 * survives a reload.
 */
export default function useFurnaceSelection() {
  const state = useState<SelectionState>('furnace-selection', createDefaultState)

  function persist() {
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
    }
  }

  function loadPersisted() {
    if (!import.meta.client) return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as Partial<SelectionState>
      state.value = { ...createDefaultState(), ...parsed }
    } catch {
      // Ignore malformed persisted state and keep defaults.
    }
  }

  function setModel(model: ModelKey) {
    state.value = { ...state.value, model }
    persist()
  }

  function setZone(zone: Zone) {
    const availableKeys = new Set(getZoneSignals(zone).map(signal => signal.key))
    const carriedSignals = state.value.signals
      .map(key => key.replace(/zone \d+/, `zone ${zone}`))
      .filter(key => availableKeys.has(key))

    state.value = {
      ...state.value,
      zone,
      signals: carriedSignals.length ? carriedSignals : defaultSignals(zone)
    }
    persist()
  }

  function setPhase(phase: Phase) {
    state.value = { ...state.value, phase }
    persist()
  }

  function setSignals(signals: string[]) {
    state.value = { ...state.value, signals }
    persist()
  }

  const selection = computed(() => state.value)
  const availableSignals = computed(() => getZoneSignals(state.value.zone))

  return {
    selection,
    availableSignals,
    setModel,
    setZone,
    setPhase,
    setSignals,
    loadPersisted
  }
}
