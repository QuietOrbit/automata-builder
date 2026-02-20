<template>
  <div class="transition-row">
    <select
      class="select target-select"
      :value="transition.targetId"
      @change="onTargetChange"
    >
      <option value="" disabled>Target...</option>
      <option
        v-for="s in availableTargets"
        :key="s.id"
        :value="s.id"
      >
        {{ s.name }}
      </option>
    </select>

    <input
      class="input input-mono symbols-input"
      :value="transition.symbols.join(', ')"
      placeholder="a, b"
      @change="onSymbolsChange"
      @keydown.enter="($event.target as HTMLInputElement).blur()"
    />

    <button class="btn btn-ghost btn-icon" @click="$emit('remove')" title="Remove transition">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Transition } from '~/types/automaton'
import { useAutomatonStore } from '~/stores/automaton'

const props = defineProps<{
  transition: Transition
}>()

const emit = defineEmits<{
  remove: []
}>()

const automaton = useAutomatonStore()

const availableTargets = computed(() => automaton.states)

function onTargetChange(event: Event) {
  const targetId = (event.target as HTMLSelectElement).value
  if (targetId) {
    automaton.updateTransitionTarget(props.transition.id, targetId)
  }
}

function onSymbolsChange(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  const symbols = raw
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
  automaton.updateTransitionSymbols(props.transition.id, symbols)
}
</script>

<style scoped>
.transition-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.target-select {
  flex: 0 0 80px;
  font-size: 12px;
  padding: 4px 6px;
}

.symbols-input {
  flex: 1;
  font-size: 12px;
  padding: 4px 6px;
  min-width: 0;
}

.btn-icon {
  padding: 4px;
  flex-shrink: 0;
}
</style>
