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

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  selection.selectState(props.state.id)
  emit('dragstart', props.state.id, event)
}
</script>
