<template>
  <div class="workspace">
    <SvgCanvas class="canvas-area" />
    <div
      class="resize-handle"
      @pointerdown="onPointerDown"
    />
    <aside class="side-panel" :style="{ width: panelWidth + 'px' }">
      <StateEditor v-if="selection.selectedStateId" />
      <TupleBuilder v-else />
      <SimulationPanel />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSelectionStore } from '~/stores/selection'

const selection = useSelectionStore()

const panelWidth = ref(320)
const MIN_WIDTH = 200
const MAX_WIDTH = 600

function onPointerDown(e: PointerEvent) {
  const handle = e.currentTarget as HTMLElement
  handle.setPointerCapture(e.pointerId)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'

  const onPointerMove = (ev: PointerEvent) => {
    const newWidth = window.innerWidth - ev.clientX
    panelWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth))
  }

  const onPointerUp = () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    handle.removeEventListener('pointermove', onPointerMove)
    handle.removeEventListener('pointerup', onPointerUp)
  }

  handle.addEventListener('pointermove', onPointerMove)
  handle.addEventListener('pointerup', onPointerUp)
}
</script>
