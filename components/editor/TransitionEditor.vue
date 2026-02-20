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
      :value="transition.symbol"
      placeholder="a"
      @change="onSymbolChange"
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

defineEmits<{
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

function onSymbolChange(event: Event) {
  const symbol = (event.target as HTMLInputElement).value.trim()
  automaton.updateTransitionSymbol(props.transition.id, symbol)
}
</script>
