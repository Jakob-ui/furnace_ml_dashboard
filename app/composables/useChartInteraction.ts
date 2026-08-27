export interface ZoomableEvent {
  id: string
  start: Date
  end: Date
}

/**
 * Shared state connecting the events list and the temperature / anomaly
 * score charts: selecting an event (from either side) zooms the charts to
 * its time range and highlights the corresponding list row / chart markers.
 */
export default function useChartInteraction() {
  const selectedEventId = useState<string | null>('furnace-selected-event', () => null)
  const zoomDomain = useState<[number, number] | null>('furnace-zoom-domain', () => null)

  function selectEvent(event: ZoomableEvent | null) {
    if (!event) {
      selectedEventId.value = null
      return
    }

    selectedEventId.value = event.id

    const startMs = event.start.getTime()
    const endMs = event.end.getTime()
    const paddingMs = Math.max((endMs - startMs) * 0.2, 30_000)

    zoomDomain.value = [startMs - paddingMs, endMs + paddingMs]
  }

  function resetZoom() {
    zoomDomain.value = null
    selectedEventId.value = null
  }

  return {
    selectedEventId,
    zoomDomain,
    selectEvent,
    resetZoom
  }
}
