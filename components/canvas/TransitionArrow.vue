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
import { useTransitionRouting } from '~/composables/useTransitionRouting'
import { useSelectionStore } from '~/stores/selection'
import { useSimulationStore } from '~/stores/simulation'

const props = defineProps<{
  transition: Transition
}>()

const { getTransitionPath } = useTransitionRouting()
const selection = useSelectionStore()
const simulation = useSimulationStore()

const pathData = computed(() => getTransitionPath(props.transition))

const label = computed(() => props.transition.symbol)

const labelWidth = computed(() => label.value.length * 7.5)

const isActive = computed(() => selection.selectedTransitionId === props.transition.id)

const isSimActive = computed(() => {
  if (simulation.status === 'idle') return false
  // Check if the last history entry used this transition
  const lastEntry = simulation.history[simulation.history.length - 1]
  return lastEntry?.transitionId === props.transition.id
})

const markerUrl = computed(() => {
  if (isSimActive.value) return 'url(#arrowhead-sim)'
  if (isActive.value) return 'url(#arrowhead-active)'
  return 'url(#arrowhead)'
})
</script>
