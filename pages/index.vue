<template>
  <div class="workspace">
    <SvgCanvas class="canvas-area" />
    <div
      class="resize-handle"
      @pointerdown="onPointerDown"
    />
    <aside
      class="side-panel"
      :style="{ width: panelWidth + 'px' }"
    >
      <div class="type-toggle-section">
        <span class="field-label">Type</span>
        <div class="tuple-type-toggle">
          <button
            class="btn btn-sm"
            :class="automaton.type === AutomatonType.DFA ? 'btn-primary' : 'btn-ghost'"
            @click="setType(AutomatonType.DFA)"
          >
            DFA
          </button>
          <button
            class="btn btn-sm"
            :class="automaton.type === AutomatonType.NFA ? 'btn-primary' : 'btn-ghost'"
            @click="setType(AutomatonType.NFA)"
          >
            NFA
          </button>
        </div>
      </div>
      <TupleBuilder />
      <RegexPanel />
      <!-- <ConversionPanel /> -->
      <MinimizationPanel />
      <SimulationPanel />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAutomatonStore } from "~/stores/automaton";
import { useSimulationStore } from "~/stores/simulation";
import { AutomatonType } from "~/types/automaton";

const automaton = useAutomatonStore();
const simulation = useSimulationStore();

function setType(type: AutomatonType) {
  if (automaton.type === type) return;
  automaton.setType(type);
  simulation.reset();
}

const panelWidth = ref(320);
const MIN_WIDTH = 200;
const MAX_WIDTH = 600;

function onPointerDown(e: PointerEvent) {
  const handle = e.currentTarget as HTMLElement;
  handle.setPointerCapture(e.pointerId);
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";

  const onPointerMove = (ev: PointerEvent) => {
    const newWidth = window.innerWidth - ev.clientX;
    panelWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
  };

  const onPointerUp = () => {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", onPointerUp);
  };

  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerUp);
}
</script>
