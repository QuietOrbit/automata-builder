<template>
  <g class="start-arrow">
    <path
      :d="path"
      fill="none"
      stroke-width="2"
      class="arrow-path"
      marker-end="url(#arrowhead)"
    />
  </g>
</template>

<script setup lang="ts">
import type { AutomatonState } from '~/types/automaton'
import { STATE_RADIUS, computeStartArrowPath } from '~/utils/geometry'

const props = defineProps<{
  state: AutomatonState
}>()

const path = computed(() => computeStartArrowPath(props.state.position, STATE_RADIUS))
</script>
