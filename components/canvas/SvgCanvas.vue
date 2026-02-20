<template>
  <div
    class="svg-canvas-wrapper"
    @keydown.delete="onDelete"
    @keydown.backspace="onDelete"
    @keydown.escape="selection.clearSelection()"
    tabindex="0"
  >
    <svg
      ref="svgRef"
      class="svg-canvas"
      :viewBox="viewBox"
      @wheel.prevent="onWheel"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
    >
      <defs>
        <!-- Grid patterns -->
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            :stroke="gridColor"
            stroke-width="0.5"
          />
        </pattern>
        <pattern id="grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#grid)" />
          <path
            d="M 100 0 L 0 0 0 100"
            fill="none"
            :stroke="gridMajorColor"
            stroke-width="1"
          />
        </pattern>

        <!-- Arrowhead markers -->
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" :fill="arrowColor" />
        </marker>
        <marker
          id="arrowhead-active"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" :fill="activeArrowColor" />
        </marker>
        <marker
          id="arrowhead-sim"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" :fill="simArrowColor" />
        </marker>
      </defs>

      <!-- Background grid (receives pointer/dblclick events for canvas) -->
      <rect
        x="-10000"
        y="-10000"
        width="20000"
        height="20000"
        fill="url(#grid-major)"
        class="grid-bg"
        @pointerdown="onCanvasPointerDown"
        @dblclick="onDoubleClick"
      />

      <!-- Transition arrows (below states) -->
      <TransitionArrow
        v-for="t in automaton.transitions"
        :key="t.id"
        :transition="t"
      />

      <!-- Start arrow -->
      <StartArrow v-if="automaton.startState" :state="automaton.startState" />

      <!-- State nodes (on top) -->
      <StateNode
        v-for="s in automaton.states"
        :key="s.id"
        :state="s"
        @dragstart="onStateDragStart"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { useAutomatonStore } from '~/stores/automaton'
import { useSelectionStore } from '~/stores/selection'
import { useCanvasInteraction } from '~/composables/useCanvasInteraction'
import { useDragState } from '~/composables/useDragState'

const automaton = useAutomatonStore()
const selection = useSelectionStore()

const svgRef = ref<SVGSVGElement | null>(null)
const { viewBox, screenToWorld, onWheel, onPanStart, onPanMove, onPanEnd, isPanning } =
  useCanvasInteraction(svgRef)
const { isDragging, onDragStart, onDragMove, onDragEnd } = useDragState(screenToWorld)

// Track if we moved during a pointer down (to distinguish click from drag)
const didMove = ref(false)

// Theme-aware colors for SVG markers (CSS vars don't work reliably in markers)
const colorMode = useColorMode()
const gridColor = computed(() => (colorMode.value === 'dark' ? '#2a2a3e' : '#e5e7eb'))
const gridMajorColor = computed(() => (colorMode.value === 'dark' ? '#3a3a4e' : '#d1d5db'))
const arrowColor = computed(() => (colorMode.value === 'dark' ? '#94a3b8' : '#6b7280'))
const activeArrowColor = computed(() => (colorMode.value === 'dark' ? '#818cf8' : '#3b82f6'))
const simArrowColor = computed(() => (colorMode.value === 'dark' ? '#4ade80' : '#22c55e'))

function onCanvasPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  didMove.value = false
  selection.clearSelection()
  onPanStart(event)
}

function onPointerMove(event: PointerEvent) {
  didMove.value = true
  if (isDragging.value) {
    onDragMove(event)
  } else {
    onPanMove(event)
  }
}

function onPointerUp(_event: PointerEvent) {
  onDragEnd()
  onPanEnd()
}

function onDoubleClick(event: MouseEvent) {
  const pos = screenToWorld(event.clientX, event.clientY)
  automaton.addState(pos)
}

function onStateDragStart(stateId: string, event: PointerEvent) {
  onDragStart(stateId, event)
}

function onDelete() {
  if (selection.selectedStateId) {
    automaton.removeState(selection.selectedStateId)
    selection.clearSelection()
  } else if (selection.selectedTransitionId) {
    automaton.removeTransition(selection.selectedTransitionId)
    selection.clearSelection()
  }
}
</script>

<style scoped>
.svg-canvas-wrapper {
  width: 100%;
  height: 100%;
  outline: none;
  overflow: hidden;
  cursor: grab;
}

.svg-canvas-wrapper:active {
  cursor: grabbing;
}

.svg-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
