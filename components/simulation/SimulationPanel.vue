<template>
  <div class="simulation-panel">
    <h3 class="panel-title">
      Simulation
    </h3>

    <!-- Input string -->
    <div class="field">
      <label
        class="field-label"
        for="sim-input-string"
      >Input String</label>
      <input
        id="sim-input-string"
        class="input input-mono"
        :value="sim.input"
        placeholder="e.g. 0110"
        @input="onInputChange"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      >
    </div>

    <!-- Input visualization -->
    <div
      v-if="sim.input.length > 0"
      class="input-viz"
    >
      <span
        v-for="(ch, i) in sim.input.split('')"
        :key="i"
        class="input-char"
        :class="{
          current: i === sim.currentIndex && sim.status === SimulationStatus.Running,
          consumed: i < sim.currentIndex,
          remaining: i > sim.currentIndex || sim.status !== SimulationStatus.Running,
          clickable: sim.status !== SimulationStatus.Idle || sim.canStep,
        }"
        @click="onCharClick(i)"
      >
        {{ ch }}
      </span>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button
        class="btn btn-primary"
        :disabled="!sim.canStepBack"
        title="Step Back"
        @click="stepBack"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path
            d="M9 3L5 7l4 4"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <button
        class="btn btn-primary"
        :disabled="!sim.canStep"
        title="Step Forward"
        @click="step"
      >
        Step
      </button>

      <button
        class="btn btn-primary"
        :disabled="!sim.canStep"
        title="Run to End"
        @click="runToEnd"
      >
        Run
      </button>

      <button
        class="btn btn-ghost"
        :disabled="sim.status === SimulationStatus.Idle"
        title="Reset"
        @click="reset"
      >
        Reset
      </button>
    </div>

    <!-- Status -->
    <div
      v-if="sim.status !== SimulationStatus.Idle"
      class="status"
      :class="{
        'status-running': sim.status === SimulationStatus.Running,
        'status-accepted': sim.status === SimulationStatus.Accepted,
        'status-rejected': sim.status === SimulationStatus.Rejected,
        'status-stuck': sim.status === SimulationStatus.Stuck,
      }"
    >
      <span class="status-dot" />
      <span class="status-text">{{ statusText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SimulationStatus } from "~/types/automaton";
import { useSimulationStore } from "~/stores/simulation";
import { useAutomatonStore } from "~/stores/automaton";

const sim = useSimulationStore();
const automaton = useAutomatonStore();

const currentStateDisplay = computed(() => {
  if (sim.currentStateIds.length === 0) return null;
  const names = sim.currentStateIds
    .map(id => automaton.getState(id)?.name)
    .filter((n): n is string => n != null);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  return `{${names.join(", ")}}`;
});

const statusText = computed(() => {
  const stateLabel = currentStateDisplay.value ?? "";

  switch (sim.status) {
    case SimulationStatus.Running: {
      const symbol = sim.input[sim.currentIndex] ?? "";
      return `In ${stateLabel} — reading '${symbol}' (${sim.currentIndex} / ${sim.input.length})`;
    }
    case SimulationStatus.Accepted:
      return `Accepted in ${stateLabel}`;
    case SimulationStatus.Rejected:
      return `Rejected in ${stateLabel}`;
    case SimulationStatus.Stuck: {
      const symbol = sim.input[sim.currentIndex] ?? "";
      return `Stuck — no transition for '${symbol}' from ${stateLabel}`;
    }
    default:
      return "";
  }
});

function onInputChange(event: Event) {
  const input = (event.target as HTMLInputElement).value;
  sim.setInput(input);
}

function step() {
  sim.step();
}

function stepBack() {
  sim.stepBack();
}

function runToEnd() {
  sim.runToEnd();
}

function reset() {
  sim.reset();
}

function onCharClick(index: number) {
  sim.jumpToPosition(index);
}
</script>
