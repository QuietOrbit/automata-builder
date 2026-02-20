<template>
  <div class="simulation-panel">
    <h3 class="panel-title">Simulation</h3>

    <!-- Input string -->
    <div class="field">
      <label class="field-label" for="sim-input-string">Input String</label>
      <input
        id="sim-input-string"
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
    <div v-if="sim.status !== 'idle'" class="status" :class="{
      'status-running': sim.status === 'running',
      'status-accepted': sim.status === 'accepted',
      'status-rejected': sim.status === 'rejected',
      'status-stuck': sim.status === 'stuck',
    }">
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
