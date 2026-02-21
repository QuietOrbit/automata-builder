<template>
  <div
    v-show="!isDragging"
    ref="bubbleRef"
    class="state-bubble"
    :class="{ 'bubble-below': isBelow }"
    :style="bubbleStyle"
    @pointerdown.stop
    @click.stop
  >
    <div class="bubble-tail" />

    <!-- Name -->
    <div class="bubble-field">
      <label
        class="field-label"
        for="bubble-name-input"
      >Name</label>
      <input
        id="bubble-name-input"
        class="input input-mono"
        :value="state.name"
        @input="onNameInput"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      >
    </div>

    <!-- Toggles -->
    <div class="bubble-toggles">
      <div
        class="toggle-field"
        @click="toggleStart"
      >
        <span class="field-label">Start</span>
        <div
          class="toggle"
          :class="{ active: state.isStart }"
        />
      </div>
      <div
        class="toggle-field"
        @click="toggleAccept"
      >
        <span class="field-label">Accept</span>
        <div
          class="toggle"
          :class="{ active: state.isAccept }"
        />
      </div>
    </div>

    <!-- Transitions -->
    <div class="bubble-field">
      <span class="field-label">Transitions</span>
      <div class="bubble-transitions-list">
        <!-- DFA mode: one fixed row per state -->
        <template v-if="isDFA">
          <TransitionEditor
            v-for="row in dfaRows"
            :key="row.targetId"
            :source-id="state.id"
            :transitions="row.transitions"
            :fixed-target="row.targetId"
          />
        </template>

        <!-- NFA mode: grouped rows + new row -->
        <template v-else>
          <TransitionEditor
            v-for="group in transitionGroups"
            :key="group.targetId"
            :source-id="state.id"
            :transitions="group.transitions"
          />
          <TransitionEditor
            :key="'new-' + transitionGroups.length"
            :source-id="state.id"
            :transitions="[]"
          />
        </template>
      </div>
    </div>

    <!-- Delete -->
    <button
      class="btn btn-danger btn-full"
      @click="deleteState"
    >
      Delete State
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AutomatonState, Position } from "~/types/automaton";
import { AutomatonType } from "~/types/automaton";
import { STATE_RADIUS } from "~/utils/geometry";
import { useAutomatonStore } from "~/stores/automaton";
import { useSelectionStore } from "~/stores/selection";

const props = defineProps<{
  state: AutomatonState;
  worldToScreen: (x: number, y: number) => Position;
  svgEl: SVGSVGElement | null;
  isDragging: boolean;
  zoom: number;
}>();

const automaton = useAutomatonStore();
const selection = useSelectionStore();

const bubbleRef = ref<HTMLElement | null>(null);
const bubbleWidth = ref(0);
const bubbleHeight = ref(0);
const isBelow = ref(false);

/** Gap between state circle edge and bubble in screen pixels. */
const BUBBLE_GAP = 10;

// Track bubble dimensions via ResizeObserver
let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      bubbleWidth.value = entry.contentRect.width;
      bubbleHeight.value = entry.contentRect.height;
    }
  });
  if (bubbleRef.value) {
    resizeObserver.observe(bubbleRef.value);
  }
});
onUnmounted(() => {
  resizeObserver?.disconnect();
});
// Re-observe when the bubble element appears
watch(bubbleRef, (el) => {
  resizeObserver?.disconnect();
  if (el) resizeObserver?.observe(el);
});

const bubbleStyle = computed(() => {
  const screenPos = props.worldToScreen(props.state.position.x, props.state.position.y);
  const radiusInPx = STATE_RADIUS * props.zoom;

  // SVG bounding rect for edge clamping
  const svgRect = props.svgEl?.getBoundingClientRect();
  const canvasLeft = svgRect?.left ?? 0;
  const canvasRight = svgRect?.right ?? window.innerWidth;
  const canvasTop = svgRect?.top ?? 0;

  // Try above first
  let top = screenPos.y - radiusInPx - BUBBLE_GAP - bubbleHeight.value;
  if (top < canvasTop) {
    // Flip below
    top = screenPos.y + radiusInPx + BUBBLE_GAP;
    isBelow.value = true;
  }
  else {
    isBelow.value = false;
  }

  // Center horizontally, then clamp
  let left = screenPos.x - bubbleWidth.value / 2;
  const EDGE_PADDING = 8;
  if (left < canvasLeft + EDGE_PADDING) {
    left = canvasLeft + EDGE_PADDING;
  }
  else if (left + bubbleWidth.value > canvasRight - EDGE_PADDING) {
    left = canvasRight - EDGE_PADDING - bubbleWidth.value;
  }

  return {
    top: `${top}px`,
    left: `${left}px`,
  };
});

// --- Transitions logic (mirrored from StateEditor) ---

const transitions = computed(() => automaton.getTransitionsFrom(props.state.id));
const isDFA = computed(() => automaton.type === AutomatonType.DFA);

const dfaRows = computed(() =>
  automaton.states.map(targetState => ({
    targetId: targetState.id,
    transitions: transitions.value.filter(t => t.targetId === targetState.id),
  })),
);

const transitionGroups = computed(() => {
  const groupMap = new Map<string, typeof transitions.value>();
  for (const t of transitions.value) {
    const existing = groupMap.get(t.targetId);
    if (existing) {
      existing.push(t);
    }
    else {
      groupMap.set(t.targetId, [t]);
    }
  }
  return Array.from(groupMap.entries()).map(([targetId, trans]) => ({
    targetId,
    transitions: trans,
  }));
});

// --- Edit handlers ---

function onNameInput(event: Event) {
  const name = (event.target as HTMLInputElement).value;
  automaton.updateState(props.state.id, { name });
}

function toggleStart() {
  if (props.state.isStart) return;
  automaton.setStartState(props.state.id);
}

function toggleAccept() {
  automaton.updateState(props.state.id, { isAccept: !props.state.isAccept });
}

function deleteState() {
  automaton.removeState(props.state.id);
  selection.clearSelection();
}
</script>
