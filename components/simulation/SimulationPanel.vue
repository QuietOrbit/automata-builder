<template>
  <div class="simulation-panel">
    <h3 class="panel-title">Simulation</h3>

    <!-- Input string -->
    <div class="field">
      <label class="field-label">Input String</label>
      <input
        class="input input-mono"
        :value="sim.input"
        @input="onInputChange"
        placeholder="e.g. 0110"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </div>

    <!-- Input visualization -->
    <div v-if="sim.input.length > 0" class="input-viz">
      <span
        v-for="(ch, i) in sim.input.split('')"
        :key="i"
        class="input-char"
        :class="{
          current: i === sim.currentIndex && sim.status === 'running',
          consumed: i < sim.currentIndex,
          remaining: i > sim.currentIndex || sim.status !== 'running',
        }"
      >
        {{ ch }}
      </span>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button
        class="btn btn-primary"
        :disabled="!sim.canStepBack"
        @click="stepBack"
        title="Step Back"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 3L5 7l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <button
        class="btn btn-primary"
        :disabled="!sim.canStep"
        @click="step"
        title="Step Forward"
      >
        Step
      </button>

      <button
        class="btn btn-primary"
        :disabled="!sim.canStep"
        @click="runToEnd"
        title="Run to End"
      >
        Run
      </button>

      <button
        class="btn btn-ghost"
        :disabled="sim.status === 'idle'"
        @click="reset"
        title="Reset"
      >
        Reset
      </button>
    </div>

    <!-- Status -->
    <div v-if="sim.status !== 'idle'" class="status" :class="statusClass">
      <span class="status-dot"></span>
      <span class="status-text">{{ statusText }}</span>
    </div>

    <!-- Current state info -->
    <div v-if="currentStateName" class="info-row">
      <span class="info-label">Current State:</span>
      <span class="info-value mono">{{ currentStateName }}</span>
    </div>

    <div v-if="sim.status !== 'idle'" class="info-row">
      <span class="info-label">Position:</span>
      <span class="info-value mono">{{ sim.currentIndex }} / {{ sim.input.length }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSimulationStore } from '~/stores/simulation'
import { useAutomatonStore } from '~/stores/automaton'

const sim = useSimulationStore()
const automaton = useAutomatonStore()

const currentStateName = computed(() => {
  if (!sim.currentStateId) return null
  return automaton.getState(sim.currentStateId)?.name ?? null
})

const statusText = computed(() => {
  switch (sim.status) {
    case 'running':
      return 'Running'
    case 'accepted':
      return 'Accepted'
    case 'rejected':
      return 'Rejected'
    case 'stuck':
      return 'Stuck (no transition)'
    default:
      return ''
  }
})

const statusClass = computed(() => `status-${sim.status}`)

function onInputChange(event: Event) {
  const input = (event.target as HTMLInputElement).value
  sim.setInput(input)
}

function step() {
  sim.step()
}

function stepBack() {
  sim.stepBack()
}

function runToEnd() {
  sim.runToEnd()
}

function reset() {
  sim.reset()
}
</script>

<style scoped>
.simulation-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Input visualization */
.input-viz {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  font-family: var(--font-mono);
  font-size: 16px;
}

.input-char {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 28px;
  border-radius: 4px;
  transition: background-color 0.15s, color 0.15s;
}

.input-char.consumed {
  background: var(--color-panel-border);
  color: var(--color-text-secondary);
}

.input-char.current {
  background: var(--color-button-bg);
  color: white;
  font-weight: 600;
}

.input-char.remaining {
  background: var(--color-input-bg);
  color: var(--color-text-primary);
  border: 1px solid var(--color-input-border);
}

/* Controls */
.controls {
  display: flex;
  gap: 6px;
}

/* Status */
.status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-running {
  background: color-mix(in srgb, var(--color-button-bg) 15%, var(--color-panel-bg));
  color: var(--color-button-bg);
}
.status-running .status-dot {
  background: var(--color-button-bg);
}

.status-accepted {
  background: color-mix(in srgb, var(--color-sim-accepted) 15%, var(--color-panel-bg));
  color: var(--color-sim-accepted);
}
.status-accepted .status-dot {
  background: var(--color-sim-accepted);
}

.status-rejected {
  background: color-mix(in srgb, var(--color-sim-rejected) 15%, var(--color-panel-bg));
  color: var(--color-sim-rejected);
}
.status-rejected .status-dot {
  background: var(--color-sim-rejected);
}

.status-stuck {
  background: color-mix(in srgb, var(--color-sim-stuck) 15%, var(--color-panel-bg));
  color: var(--color-sim-stuck);
}
.status-stuck .status-dot {
  background: var(--color-sim-stuck);
}

/* Info rows */
.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.info-label {
  color: var(--color-text-secondary);
}

.info-value {
  color: var(--color-text-primary);
  font-weight: 500;
}

.mono {
  font-family: var(--font-mono);
}
</style>
