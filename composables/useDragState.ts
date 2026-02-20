import type { Position } from '~/types/automaton'
import { useAutomatonStore } from '~/stores/automaton'

/**
 * Composable for dragging state nodes on the SVG canvas.
 * Tracks the drag target and offset, and updates the state's position through
 * the automaton store on each pointer move.
 *
 * @param screenToWorld - Coordinate converter from screen space to SVG world space
 *                        (provided by {@link useCanvasInteraction}).
 * @returns Reactive drag state and event handlers for pointer events.
 */
export function useDragState(screenToWorld: (x: number, y: number) => Position) {
  const automaton = useAutomatonStore()

  /** Whether a drag operation is currently in progress. */
  const isDragging = ref(false)
  /** ID of the state being dragged, or null if not dragging. */
  const dragTargetId = ref<string | null>(null)
  /** Offset between the pointer's world position and the state's center at drag start. */
  const dragOffset = reactive({ x: 0, y: 0 })

  /**
   * Begin dragging a state node. Records the offset between the pointer
   * and the state's center so the node doesn't snap to the cursor.
   * @param stateId - ID of the state being dragged.
   * @param event - The initiating pointer event.
   */
  function onDragStart(stateId: string, event: PointerEvent) {
    const state = automaton.getState(stateId)
    if (!state) return

    isDragging.value = true
    dragTargetId.value = stateId

    const worldPos = screenToWorld(event.clientX, event.clientY)
    dragOffset.x = state.position.x - worldPos.x
    dragOffset.y = state.position.y - worldPos.y
  }

  /**
   * Update the dragged state's position based on the current pointer location.
   * Applies the stored offset to maintain the grab point.
   */
  function onDragMove(event: PointerEvent) {
    if (!isDragging.value || !dragTargetId.value) return

    const worldPos = screenToWorld(event.clientX, event.clientY)
    automaton.updateState(dragTargetId.value, {
      position: {
        x: worldPos.x + dragOffset.x,
        y: worldPos.y + dragOffset.y,
      },
    })
  }

  /** End the current drag operation and clear the drag target. */
  function onDragEnd() {
    isDragging.value = false
    dragTargetId.value = null
  }

  return {
    isDragging,
    dragTargetId,
    onDragStart,
    onDragMove,
    onDragEnd,
  }
}
