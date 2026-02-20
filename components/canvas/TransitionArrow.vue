<template>
  <g v-if="pathData" class="transition-arrow" :class="{ active: isActive, 'sim-active': isSimActive }">
    <!-- Arrow path -->
    <path
      :d="pathData.path"
      fill="none"
      class="arrow-path"
      :marker-end="markerUrl"
      stroke-width="2"
    />

    <!-- Label background (for readability) -->
    <rect
      v-if="label"
      :x="pathData.labelPosition.x - labelWidth / 2 - 3"
      :y="pathData.labelPosition.y - 8"
      :width="labelWidth + 6"
      height="16"
      rx="3"
      class="label-bg"
    />

    <!-- Label text -->
    <text
      v-if="label"
      :x="pathData.labelPosition.x"
      :y="pathData.labelPosition.y"
      text-anchor="middle"
      dominant-baseline="central"
      class="label-text"
      font-size="12"
    >
      {{ label }}
    </text>
  </g>
</template>

<script setup lang="ts">
import type { Transition } from '~/types/automaton'
import { SimulationStatus } from '~/types/automaton'
import { useTransitionRouting } from '~/composables/useTransitionRouting'
import { useSelectionStore } from '~/stores/selection'
import { useSimulationStore } from '~/stores/simulation'

const props = defineProps<{
  transitions: Transition[]
}>()

const { getTransitionPath } = useTransitionRouting()
const selection = useSelectionStore()
const simulation = useSimulationStore()

// Use the first transition for routing (all share the same sourceId/targetId)
const representative = computed(() => props.transitions[0])

const pathData = computed(() => {
  if (!representative.value) return null
  return getTransitionPath(representative.value)
})

const label = computed(() =>
  props.transitions
    .map(t => t.symbol)
    .filter(s => s.length > 0)
    .join(',')
)

const labelWidth = computed(() => label.value.length * 7.5)

const transitionIds = computed(() => new Set(props.transitions.map(t => t.id)))

const isActive = computed(() =>
  selection.selectedTransitionId !== null && transitionIds.value.has(selection.selectedTransitionId)
)

const isSimActive = computed(() => {
  if (simulation.status === SimulationStatus.Idle) return false
  const lastEntry = simulation.history[simulation.history.length - 1]
  return lastEntry?.transitionId != null && transitionIds.value.has(lastEntry.transitionId)
})

const markerUrl = computed(() => {
  if (isSimActive.value) return 'url(#arrowhead-sim)'
  if (isActive.value) return 'url(#arrowhead-active)'
  return 'url(#arrowhead)'
})
</script>
