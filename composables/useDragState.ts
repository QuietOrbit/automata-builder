import type { Position } from '~/types/automaton'
import { useAutomatonStore } from '~/stores/automaton'

export function useDragState(screenToWorld: (x: number, y: number) => Position) {
  const automaton = useAutomatonStore()

  const isDragging = ref(false)
  const dragTargetId = ref<string | null>(null)
  const dragOffset = reactive({ x: 0, y: 0 })

  function onDragStart(stateId: string, event: PointerEvent) {
    const state = automaton.getState(stateId)
    if (!state) return

    isDragging.value = true
    dragTargetId.value = stateId

    const worldPos = screenToWorld(event.clientX, event.clientY)
    dragOffset.x = state.position.x - worldPos.x
    dragOffset.y = state.position.y - worldPos.y
  }

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
