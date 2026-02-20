<template>
  <g
    class="state-node"
    :class="{
      selected: isSelected,
      'is-current': isSimCurrent,
      'is-accepted': isSimAccepted,
      'is-rejected': isSimRejected,
      'is-stuck': isSimStuck,
    }"
    :transform="`translate(${state.position.x}, ${state.position.y})`"
    @pointerdown.stop="onPointerDown"
    @click.stop
    style="cursor: pointer"
  >
    <!-- Accept state: outer ring -->
    <circle
      v-if="state.isAccept"
      :r="STATE_RADIUS + 5"
      class="accept-ring"
    />

    <!-- Main circle -->
    <circle :r="STATE_RADIUS" class="state-circle" />

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
import type { AutomatonState } from '~/types/automaton'
import { STATE_RADIUS } from '~/utils/geometry'
import { useSelectionStore } from '~/stores/selection'
import { useSimulationStore } from '~/stores/simulation'

const props = defineProps<{
  state: AutomatonState
}>()

const emit = defineEmits<{
  dragstart: [stateId: string, event: PointerEvent]
}>()

const selection = useSelectionStore()
const simulation = useSimulationStore()

const isSelected = computed(() => selection.selectedStateId === props.state.id)
const isSimCurrent = computed(
  () => simulation.status !== 'idle' && simulation.currentStateId === props.state.id && simulation.status === 'running',
)
const isSimAccepted = computed(
  () => simulation.currentStateId === props.state.id && simulation.status === 'accepted',
)
const isSimRejected = computed(
  () => simulation.currentStateId === props.state.id && simulation.status === 'rejected',
)
const isSimStuck = computed(
  () => simulation.currentStateId === props.state.id && simulation.status === 'stuck',
)

const labelFontSize = computed(() => {
  const len = props.state.name.length
  if (len <= 2) return 16
  if (len <= 4) return 13
  return 11
})

let pointerDownAt = { x: 0, y: 0 }

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  pointerDownAt = { x: event.clientX, y: event.clientY }
  selection.selectState(props.state.id)
  emit('dragstart', props.state.id, event)
}
</script>

<style scoped>
.state-circle {
  fill: var(--color-state-fill);
  stroke: var(--color-state-stroke);
  stroke-width: 2;
  transition: stroke 0.15s, fill 0.15s;
}

.accept-ring {
  fill: none;
  stroke: var(--color-state-accept-ring);
  stroke-width: 2;
  transition: stroke 0.15s;
}

.state-label {
  fill: var(--color-state-text);
  font-family: var(--font-mono);
  pointer-events: none;
  user-select: none;
}

/* Selected */
.selected .state-circle {
  stroke: var(--color-state-selected);
  stroke-width: 2.5;
}

.selected .accept-ring {
  stroke: var(--color-state-selected);
}

/* Simulation states */
.is-current .state-circle {
  stroke: var(--color-sim-current);
  stroke-width: 3;
}
.is-current .accept-ring {
  stroke: var(--color-sim-current);
}

.is-accepted .state-circle {
  stroke: var(--color-sim-accepted);
  stroke-width: 3;
  fill: color-mix(in srgb, var(--color-sim-accepted) 15%, var(--color-state-fill));
}
.is-accepted .accept-ring {
  stroke: var(--color-sim-accepted);
}

.is-rejected .state-circle {
  stroke: var(--color-sim-rejected);
  stroke-width: 3;
  fill: color-mix(in srgb, var(--color-sim-rejected) 15%, var(--color-state-fill));
}
.is-rejected .accept-ring {
  stroke: var(--color-sim-rejected);
}

.is-stuck .state-circle {
  stroke: var(--color-sim-stuck);
  stroke-width: 3;
  fill: color-mix(in srgb, var(--color-sim-stuck) 15%, var(--color-state-fill));
}
.is-stuck .accept-ring {
  stroke: var(--color-sim-stuck);
}
</style>
