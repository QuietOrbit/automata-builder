<template>
  <div class="workspace">
    <SvgCanvas class="canvas-area" />
    <aside class="side-panel">
      <StateEditor v-if="selection.selectedStateId" />
      <div v-else class="panel-empty">
        <p>Double-click the canvas to add a state.</p>
        <p>Click a state to select and edit it.</p>
      </div>
      <SimulationPanel />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { useSelectionStore } from '~/stores/selection'

const selection = useSelectionStore()
</script>
