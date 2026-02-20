import { reactive, computed, type Ref } from 'vue'
import type { Position } from '~/types/automaton'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 5
const ZOOM_SENSITIVITY = 0.001

export function useCanvasInteraction(svgRef: Ref<SVGSVGElement | null>) {
  const pan = reactive({ x: -400, y: -300 })
  const zoom = ref(1)

  const isPanning = ref(false)
  const panStart = reactive({ x: 0, y: 0 })

  const viewBox = computed(() => {
    const svgEl = svgRef.value
    if (!svgEl) return '0 0 800 600'
    const rect = svgEl.getBoundingClientRect()
    const w = rect.width / zoom.value
    const h = rect.height / zoom.value
    return `${pan.x} ${pan.y} ${w} ${h}`
  })

  function screenToWorld(screenX: number, screenY: number): Position {
    const svgEl = svgRef.value
    if (!svgEl) return { x: screenX, y: screenY }
    const rect = svgEl.getBoundingClientRect()
    return {
      x: (screenX - rect.left) / zoom.value + pan.x,
      y: (screenY - rect.top) / zoom.value + pan.y,
    }
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault()

    const svgEl = svgRef.value
    if (!svgEl) return

    // Get cursor position in world coords before zoom
    const worldBefore = screenToWorld(event.clientX, event.clientY)

    // Apply zoom
    const delta = -event.deltaY * ZOOM_SENSITIVITY
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value * (1 + delta)))
    zoom.value = newZoom

    // Adjust pan so cursor stays over the same world point
    const rect = svgEl.getBoundingClientRect()
    pan.x = worldBefore.x - (event.clientX - rect.left) / newZoom
    pan.y = worldBefore.y - (event.clientY - rect.top) / newZoom
  }

  function onPanStart(event: PointerEvent) {
    isPanning.value = true
    panStart.x = event.clientX
    panStart.y = event.clientY
  }

  function onPanMove(event: PointerEvent) {
    if (!isPanning.value) return
    const dx = (event.clientX - panStart.x) / zoom.value
    const dy = (event.clientY - panStart.y) / zoom.value
    pan.x -= dx
    pan.y -= dy
    panStart.x = event.clientX
    panStart.y = event.clientY
  }

  function onPanEnd() {
    isPanning.value = false
  }

  return {
    pan,
    zoom,
    viewBox,
    isPanning,
    screenToWorld,
    onWheel,
    onPanStart,
    onPanMove,
    onPanEnd,
  }
}
