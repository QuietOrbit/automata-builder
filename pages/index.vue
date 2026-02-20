<template>
  <div class="workspace">
    <SvgCanvas class="canvas-area" />
    <aside class="side-panel">
      <StateEditor v-if="selection.selectedStateId" />
      <TupleBuilder v-else />
      <SimulationPanel />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { useSelectionStore } from '~/stores/selection'

const selection = useSelectionStore()
</script>
