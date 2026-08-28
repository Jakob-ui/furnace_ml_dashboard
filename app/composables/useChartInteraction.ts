import { computed } from 'vue'
import type { FurnaceEvent } from '~/composables/useFurnaceData'

/**
 * Ein Zustand verbindet Ereignisliste und Plots (Claude.md §7): Ein Ereignis
 * auswählen — aus Liste oder Plot — zoomt beide Plots auf dessen Zeitbereich und
 * hebt es hervor. `xDomain` und `selectedEventId` laufen nie auseinander.
 */
export default function useChartInteraction() {
  const selectedEventId = useState<string | null>('furnace-selected-event', () => null)
  const xDomain = useState<[number, number] | null>('furnace-x-domain', () => null)

  function zoomToEvent(event: Pick<FurnaceEvent, 'id' | 'start' | 'end'>) {
    selectedEventId.value = event.id
    const durationMs = Math.max(0, event.end - event.start)
    const padding = Math.max(durationMs * 0.25, 30_000)
    xDomain.value = [event.start - padding, event.end + padding]
  }

  function selectEvent(event: FurnaceEvent | null) {
    if (!event) {
      selectedEventId.value = null
      return
    }
    zoomToEvent(event)
  }

  /** Zoom auf ein freies Zeitfenster ohne Ereignisbezug (z. B. Brush). */
  function setDomain(domain: [number, number] | null) {
    xDomain.value = domain
  }

  function reset() {
    xDomain.value = null
    selectedEventId.value = null
  }

  const isZoomed = computed(() => xDomain.value !== null)

  return {
    selectedEventId,
    xDomain,
    isZoomed,
    selectEvent,
    zoomToEvent,
    setDomain,
    reset
  }
}
