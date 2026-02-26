<template>
  <div class="workspace">
    <SvgCanvas class="canvas-area" />
    <aside
      v-show="!viewport.isFullscreen"
      class="side-panel"
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

      <TabBar
        :model-value="sidebar.activeTab"
        @update:model-value="sidebar.setTab($event)"
      />

      <div class="sidebar-content">
        <!-- Build tab -->
        <div v-show="sidebar.activeTab === SidebarTab.Build">
          <SidebarSection
            section-id="build:tuple"
            title="5-Tuple Definition"
          >
            <TupleBuilder />
          </SidebarSection>
          <SidebarSection
            section-id="build:regex"
            title="Regex Builder"
          >
            <RegexPanel />
          </SidebarSection>
        </div>

        <!-- Transform tab -->
        <div v-show="sidebar.activeTab === SidebarTab.Transform">
          <ConversionPanel />
          <MinimizationPanel />
        </div>

        <!-- Simulate tab -->
        <div v-show="sidebar.activeTab === SidebarTab.Simulate">
          <SimulationPanel />
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { useAutomatonStore } from "~/stores/automaton";
import { useSimulationStore } from "~/stores/simulation";
import { useViewportStore } from "~/stores/viewport";
import { useSidebarStore, SidebarTab } from "~/stores/sidebar";
import { AutomatonType, SimulationStatus } from "~/types/automaton";

const automaton = useAutomatonStore();
const simulation = useSimulationStore();
const viewport = useViewportStore();
const sidebar = useSidebarStore();

function setType(type: AutomatonType) {
  if (automaton.type === type) return;
  automaton.setType(type);
  simulation.reset();
}

// Auto-switch to Simulate tab when simulation starts
watch(() => simulation.status, (status) => {
  if (status !== SimulationStatus.Idle) {
    sidebar.setTab(SidebarTab.Simulate);
  }
});
</script>
