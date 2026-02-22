<template>
  <g
    class="state-node"
    :class="{
      'selected': isSelected,
      'is-hover-target': isHoverTarget,
      'is-current': isSimCurrent,
      'is-accepted': isSimAccepted,
      'is-rejected': isSimRejected,
      'is-stuck': isSimStuck,
    }"
    :transform="`translate(${state.position.x}, ${state.position.y})`"
    style="cursor: pointer"
    @pointerdown.stop="onPointerDown"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @click.stop
  >
    <!-- Accept state: outer ring -->
    <circle
      v-if="state.isAccept"
      :r="STATE_RADIUS + 5"
      class="accept-ring"
    />

    <!-- Main circle -->
    <circle
      :r="STATE_RADIUS"
      class="state-circle"
    />

    <!-- Label -->
    <text
      class="state-label"
      text-anchor="middle"
      dominant-baseline="central"
      :font-size="labelFontSize"
    >
      {{ state.name }}
    </text>
  </g>
</template>

<script setup lang="ts">
import type { AutomatonState } from "~/types/automaton";
import { SimulationStatus } from "~/types/automaton";
import { STATE_RADIUS } from "~/utils/geometry";
import { useSelectionStore } from "~/stores/selection";
import { useSimulationStore } from "~/stores/simulation";
import { useHoverStore } from "~/stores/hover";

const props = defineProps<{
  state: AutomatonState;
}>();

const emit = defineEmits<{
  dragstart: [stateId: string, event: PointerEvent];
}>();

const selection = useSelectionStore();
const simulation = useSimulationStore();
const hover = useHoverStore();

const isSelected = computed(() => selection.selectedStateId === props.state.id);
const isHoverTarget = computed(
  () => hover.hoveredStateId === props.state.id
    && selection.selectedStateId !== props.state.id,
);
const isSimCurrent = computed(
  () => simulation.status !== SimulationStatus.Idle && simulation.currentStateIds.includes(props.state.id) && simulation.status === SimulationStatus.Running,
);
const isSimAccepted = computed(
  () => simulation.currentStateIds.includes(props.state.id) && simulation.status === SimulationStatus.Accepted,
);
const isSimRejected = computed(
  () => simulation.currentStateIds.includes(props.state.id) && simulation.status === SimulationStatus.Rejected,
);
const isSimStuck = computed(
  () => simulation.currentStateIds.includes(props.state.id) && simulation.status === SimulationStatus.Stuck,
);

const labelFontSize = computed(() => {
  const len = props.state.name.length;
  if (len <= 2) return 16;
  if (len <= 4) return 13;
  return 11;
});

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  emit("dragstart", props.state.id, event);
}

function onPointerEnter() {
  if (selection.selectedStateId !== null && selection.selectedStateId !== props.state.id) {
    hover.setHoveredState(props.state.id);
  }
}

function onPointerLeave() {
  hover.clearHoveredState();
}
</script>
