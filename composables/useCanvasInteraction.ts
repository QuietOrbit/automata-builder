import { reactive, computed, type Ref } from 'vue'
import type { Position } from '~/types/automaton'

/** Minimum zoom level (fully zoomed out). */
const MIN_ZOOM = 0.2
/** Maximum zoom level (fully zoomed in). */
const MAX_ZOOM = 5
/** Multiplier applied to wheel deltaY to control zoom speed. */
const ZOOM_SENSITIVITY = 0.001

/**
 * Composable for SVG canvas pan and zoom interaction.
 * Manages the viewBox, converts screen coordinates to canvas (world) coordinates,
 * and handles pointer-based panning and wheel-based zooming.
 *
 * @param svgRef - Reactive reference to the SVG element.
 * @returns Reactive pan/zoom state and event handlers for binding to SVG events.
 */
export function useCanvasInteraction(svgRef: Ref<SVGSVGElement | null>) {
  /** Current pan offset in world coordinates. */
  const pan = reactive({ x: -400, y: -300 })
  /** Current zoom factor (1 = 100%). */
  const zoom = ref(1)

  const isPanning = ref(false)
  /** Screen-space position where the current pan gesture started. */
  const panStart = reactive({ x: 0, y: 0 })

  /** Computed SVG viewBox string derived from pan, zoom, and element dimensions. */
  const viewBox = computed(() => {
    const svgEl = svgRef.value
    if (!svgEl) return '0 0 800 600'
    const rect = svgEl.getBoundingClientRect()
    const w = rect.width / zoom.value
    const h = rect.height / zoom.value
    return `${pan.x} ${pan.y} ${w} ${h}`
  })

  /**
   * Convert screen (client) coordinates to world (SVG canvas) coordinates.
   * @param screenX - Client X position (e.g. from a PointerEvent).
   * @param screenY - Client Y position.
   * @returns The corresponding position in SVG world space.
   */
  function screenToWorld(screenX: number, screenY: number): Position {
    const svgEl = svgRef.value
    if (!svgEl) return { x: screenX, y: screenY }
    const rect = svgEl.getBoundingClientRect()
    return {
      x: (screenX - rect.left) / zoom.value + pan.x,
      y: (screenY - rect.top) / zoom.value + pan.y,
    }
  }

  /**
   * Handle mouse wheel events for zooming. Zooms toward the cursor position
   * so the point under the cursor stays fixed.
   */
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

  /**
   * Begin a pan gesture from a pointer event.
   * @param event - The initiating pointer event (typically pointerdown on the canvas background).
   */
  function onPanStart(event: PointerEvent) {
    isPanning.value = true
    panStart.x = event.clientX
    panStart.y = event.clientY
  }

  /**
   * Continue a pan gesture by updating the pan offset from pointer movement.
   * Movement is scaled by the inverse of the current zoom level.
   */
  function onPanMove(event: PointerEvent) {
    if (!isPanning.value) return
    const dx = (event.clientX - panStart.x) / zoom.value
    const dy = (event.clientY - panStart.y) / zoom.value
    pan.x -= dx
    pan.y -= dy
    panStart.x = event.clientX
    panStart.y = event.clientY
  }

  /** End the current pan gesture. */
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
