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

<style scoped>
.workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.canvas-area {
  flex: 1;
  min-width: 0;
}

.side-panel {
  width: var(--panel-width);
  flex-shrink: 0;
  border-left: 1px solid var(--color-panel-border);
  background: var(--color-panel-bg);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel-empty {
  padding: 20px 16px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
</style>
