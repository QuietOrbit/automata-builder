<template>
  <div
    v-show="!isDragging"
    ref="bubbleRef"
    class="state-bubble"
    :style="bubbleStyle"
    @pointerdown.stop
    @click.stop
  >
    <!-- Drag header -->
    <div
      class="bubble-header"
      :class="{ 'is-dragging-header': isDraggingBubble }"
      @pointerdown="onHeaderPointerDown"
    >
      <span class="bubble-header-title mono">{{ state.name }}</span>
      <div class="bubble-header-actions">
        <button
          class="bubble-pin"
          :class="{ active: isThisPinned }"
          title="Pin bubble (keep open on canvas click)"
          @pointerdown.stop
          @click.stop="selection.togglePin(state.id)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M7 1v4M4.5 5h5l-.75 3.5H5.25L4.5 5ZM5.25 8.5L5 13M8.75 8.5L9 13"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          class="bubble-close"
          title="Close"
          @pointerdown.stop
          @click.stop="closeBubble"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Name -->
    <div class="bubble-field">
      <label
        class="field-label"
        :for="'bubble-name-input-' + state.id"
      >Name</label>
      <input
        :id="'bubble-name-input-' + state.id"
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

    <!-- Alphabet -->
    <div class="bubble-field">
      <label
        class="field-label"
        :for="'bubble-alphabet-input-' + state.id"
      >Alphabet (Σ)</label>
      <input
        :id="'bubble-alphabet-input-' + state.id"
        class="input input-mono"
        :value="alphabetDisplay"
        placeholder="a, b, c"
        @input="onAlphabetInput"
        @blur="commitAlphabet"
        @keydown="onAlphabetKeydown"
      >
    </div>

    <!-- Transition grid -->
    <div class="bubble-field bubble-field-grow">
      <span class="field-label">Transitions</span>
      <TransitionGrid :source-id="state.id" />
    </div>

    <!-- Footer -->
    <div class="bubble-footer">
      <button
        class="btn btn-ghost btn-sm"
        @click="clearTransitions"
      >
        Clear Transitions
      </button>
      <button
        class="btn btn-danger btn-sm"
        @click="deleteState"
      >
        Delete State
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AutomatonState, Position } from "~/types/automaton";
import { STATE_RADIUS } from "~/utils/geometry";
import { useAutomatonStore } from "~/stores/automaton";
import { useSelectionStore } from "~/stores/selection";
import { getBubbleOffset, setBubbleOffset } from "~/composables/useBubbleOffsets";

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

/** Gap between state circle edge and bubble in screen pixels. */
const BUBBLE_GAP = 12;
const EDGE_PADDING = 8;

const isThisPinned = computed(() => selection.isStatePinned(props.state.id));

// --- Per-instance drag state ---

const isDraggingBubble = ref(false);
let dragStartPointer = { x: 0, y: 0 };
let dragStartOffset = { x: 0, y: 0 };

// --- Position memory helpers ---

function getOffset(): { x: number; y: number } {
  return getBubbleOffset(props.state.id);
}

function setOffset(x: number, y: number) {
  setBubbleOffset(props.state.id, x, y);
}

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

/** Compute the default (un-offset) anchor position: upper-right of state. */
function computeDefaultAnchor(): { left: number; top: number } {
  const screenPos = props.worldToScreen(props.state.position.x, props.state.position.y);
  const radiusInPx = STATE_RADIUS * props.zoom;

  const left = screenPos.x + radiusInPx + BUBBLE_GAP;
  const top = screenPos.y - bubbleHeight.value / 2;
  return { left, top };
}

/** Clamp a position so the bubble stays within the canvas bounds. */
function clampToCanvas(left: number, top: number): { left: number; top: number } {
  const svgRect = props.svgEl?.getBoundingClientRect();
  const canvasLeft = svgRect?.left ?? 0;
  const canvasRight = svgRect?.right ?? window.innerWidth;
  const canvasTop = svgRect?.top ?? 0;
  const canvasBottom = svgRect?.bottom ?? window.innerHeight;

  let clampedLeft = left;
  let clampedTop = top;

  if (clampedLeft < canvasLeft + EDGE_PADDING) {
    clampedLeft = canvasLeft + EDGE_PADDING;
  }
  else if (clampedLeft + bubbleWidth.value > canvasRight - EDGE_PADDING) {
    clampedLeft = canvasRight - EDGE_PADDING - bubbleWidth.value;
  }

  if (clampedTop < canvasTop + EDGE_PADDING) {
    clampedTop = canvasTop + EDGE_PADDING;
  }
  else if (clampedTop + bubbleHeight.value > canvasBottom - EDGE_PADDING) {
    clampedTop = canvasBottom - EDGE_PADDING - bubbleHeight.value;
  }

  return { left: clampedLeft, top: clampedTop };
}

const bubbleStyle = computed(() => {
  const anchor = computeDefaultAnchor();
  const offset = getOffset();
  const rawLeft = anchor.left + offset.x;
  const rawTop = anchor.top + offset.y;
  const clamped = clampToCanvas(rawLeft, rawTop);

  return {
    top: `${clamped.top}px`,
    left: `${clamped.left}px`,
  };
});

// --- Bubble drag handlers ---

function onHeaderPointerDown(event: PointerEvent) {
  isDraggingBubble.value = true;
  dragStartPointer = { x: event.clientX, y: event.clientY };
  const current = getOffset();
  dragStartOffset = { x: current.x, y: current.y };
  document.addEventListener("pointermove", onBubblePointerMove);
  document.addEventListener("pointerup", onBubblePointerUp);
}

function onBubblePointerMove(event: PointerEvent) {
  setOffset(
    dragStartOffset.x + (event.clientX - dragStartPointer.x),
    dragStartOffset.y + (event.clientY - dragStartPointer.y),
  );
}

function onBubblePointerUp() {
  isDraggingBubble.value = false;
  document.removeEventListener("pointermove", onBubblePointerMove);
  document.removeEventListener("pointerup", onBubblePointerUp);
}

// --- Close / pin ---

function closeBubble() {
  selection.unpinState(props.state.id);
  if (selection.selectedStateId === props.state.id) {
    selection.clearSelection();
  }
}

// --- Alphabet editing ---

const alphabetDisplay = computed(() => automaton.alphabet.join(", "));
const alphabetInput = ref(automaton.alphabet.join(", "));
const isEditingAlphabet = ref(false);

watch(alphabetDisplay, (val) => {
  if (!isEditingAlphabet.value) {
    alphabetInput.value = val;
  }
});

function onAlphabetInput(e: Event) {
  alphabetInput.value = (e.target as HTMLInputElement).value;
  isEditingAlphabet.value = true;
}

function onAlphabetKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    isEditingAlphabet.value = true;
    commitAlphabet();
    return;
  }
  if (e.key === ",") {
    isEditingAlphabet.value = true;
    commitAlphabet();
  }
}

function commitAlphabet() {
  if (!isEditingAlphabet.value) return;
  isEditingAlphabet.value = false;

  const newSymbols = alphabetInput.value
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const removedSymbols = automaton.alphabet.filter(s => !newSymbols.includes(s));
  const affectedTransitions = automaton.transitions.filter(
    t => removedSymbols.includes(t.symbol),
  );

  if (affectedTransitions.length > 0) {
    const count = affectedTransitions.length;
    const syms = removedSymbols.join(", ");
    if (!confirm(`Remove symbol(s) '${syms}'? This will delete ${count} transition(s).`)) {
      alphabetInput.value = automaton.alphabet.join(", ");
      return;
    }
  }

  automaton.setAlphabet(newSymbols);
  alphabetInput.value = automaton.alphabet.join(", ");
}

// --- Transition actions ---

function clearTransitions() {
  const fromThis = automaton.getTransitionsFrom(props.state.id);
  automaton.removeTransitions(fromThis.map(t => t.id));
}

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
  selection.unpinState(props.state.id);
  automaton.removeState(props.state.id);
  if (selection.selectedStateId === props.state.id) {
    selection.clearSelection();
  }
}
</script>
