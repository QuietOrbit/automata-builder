<template>
  <div class="svg-canvas-wrapper">
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
        <pattern
          id="grid"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            :stroke="gridColor"
            stroke-width="0.5"
          />
        </pattern>
        <pattern
          id="grid-major"
          width="100"
          height="100"
          patternUnits="userSpaceOnUse"
        >
          <rect
            width="100"
            height="100"
            fill="url(#grid)"
          />
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
          <polygon
            points="0 0, 10 3.5, 0 7"
            :fill="arrowColor"
          />
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
          <polygon
            points="0 0, 10 3.5, 0 7"
            :fill="activeArrowColor"
          />
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
          <polygon
            points="0 0, 10 3.5, 0 7"
            :fill="simArrowColor"
          />
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
        v-for="group in transitionGroups"
        :key="group.key"
        :transitions="group.transitions"
      />

      <!-- Start arrow -->
      <StartArrow
        v-if="automaton.startState"
        :state="automaton.startState"
      />

      <!-- State nodes (on top) -->
      <StateNode
        v-for="s in automaton.states"
        :key="s.id"
        :state="s"
        @dragstart="onStateDragStart"
      />
    </svg>

    <StateBubble
      v-for="s in visibleBubbleStates"
      :key="s.id"
      :state="s"
      :world-to-screen="worldToScreen"
      :svg-el="svgRef"
      :is-dragging="isDragging"
      :zoom="zoom"
    />
  </div>
</template>

<script setup lang="ts">
import type { AutomatonState } from "~/types/automaton";
import { useAutomatonStore } from "~/stores/automaton";
import { useSelectionStore } from "~/stores/selection";
import { useViewportStore } from "~/stores/viewport";
import { useCanvasInteraction } from "~/composables/useCanvasInteraction";
import { useDragState } from "~/composables/useDragState";
import { buildVisualInfosFromStore } from "~/utils/collision";

const automaton = useAutomatonStore();
const selection = useSelectionStore();
const viewport = useViewportStore();

// Group transitions by (sourceId, targetId) for combined arrow rendering
const transitionGroups = computed(() => {
  const groups = new Map<string, { key: string; transitions: typeof automaton.transitions }>();
  for (const t of automaton.transitions) {
    const key = `${t.sourceId}->${t.targetId}`;
    if (!groups.has(key)) {
      groups.set(key, { key, transitions: [] });
    }
    groups.get(key)!.transitions.push(t);
  }
  return [...groups.values()];
});

const svgRef = ref<SVGSVGElement | null>(null);
const { viewBox, screenToWorld, worldToScreen, zoom, onWheel, onPanStart, onPanMove, onPanEnd, fitToContent }
  = useCanvasInteraction(svgRef);
const { isDragging, dragTargetId, hasDragged, onDragStart, onDragMove, onDragEnd } = useDragState(screenToWorld);

/** All states that should have a visible bubble (pinned + active selection, deduplicated). */
const visibleBubbleStates = computed(() => {
  const ids = new Set<string>(selection.pinnedStateIds);
  if (selection.selectedStateId) {
    ids.add(selection.selectedStateId);
  }
  return [...ids]
    .map(id => automaton.getState(id))
    .filter((s): s is AutomatonState => s != null);
});

// Fit-to-content when signaled by the viewport store (e.g. after build/relayout)
watch(() => viewport.fitRequestId, () => {
  if (automaton.states.length === 0) return;
  const visualInfos = buildVisualInfosFromStore(automaton.states, automaton.transitions);
  nextTick(() => fitToContent(visualInfos));
});

// Track if we moved during a pointer down (to distinguish click from drag)
const didMove = ref(false);

// Theme-aware colors for SVG markers (CSS vars don't work reliably in markers)
const colorMode = useColorMode();
const gridColor = computed(() => (colorMode.value === "dark" ? "#2a2a3e" : "#e5e7eb"));
const gridMajorColor = computed(() => (colorMode.value === "dark" ? "#3a3a4e" : "#d1d5db"));
const arrowColor = computed(() => (colorMode.value === "dark" ? "#94a3b8" : "#6b7280"));
const activeArrowColor = computed(() => (colorMode.value === "dark" ? "#818cf8" : "#3b82f6"));
const simArrowColor = computed(() => (colorMode.value === "dark" ? "#4ade80" : "#22c55e"));

function onCanvasPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  didMove.value = false;
  selection.clearSelection();
  onPanStart(event);
}

function onPointerMove(event: PointerEvent) {
  didMove.value = true;
  if (isDragging.value) {
    onDragMove(event);
  }
  else {
    onPanMove(event);
  }
}

function onPointerUp(_event: PointerEvent) {
  if (dragTargetId.value && !hasDragged.value) {
    selection.selectState(dragTargetId.value);
  }
  onDragEnd();
  onPanEnd();
}

function onDoubleClick(event: MouseEvent) {
  const pos = screenToWorld(event.clientX, event.clientY);
  automaton.addState(pos);
}

function onStateDragStart(stateId: string, event: PointerEvent) {
  onDragStart(stateId, event);
}

onMounted(() => document.addEventListener("keydown", onKeyDown));
onUnmounted(() => document.removeEventListener("keydown", onKeyDown));

function onKeyDown(event: KeyboardEvent) {
  const tag = (event.target as HTMLElement)?.tagName;

  if (event.key === "Escape") {
    selection.closeAll();
    (event.target as HTMLElement)?.blur();
    return;
  }

  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

  if (event.key === "Delete" || event.key === "Backspace") {
    onDelete();
  }
}

function onDelete() {
  if (selection.selectedStateId) {
    selection.unpinState(selection.selectedStateId);
    automaton.removeState(selection.selectedStateId);
    selection.clearSelection();
  }
  else if (selection.selectedTransitionId) {
    automaton.removeTransition(selection.selectedTransitionId);
    selection.clearSelection();
  }
}
</script>
