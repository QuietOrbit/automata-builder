<template>
  <!-- DFA fixed-target row -->
  <div
    v-if="fixedTarget"
    class="transition-row"
  >
    <TargetSelect
      :model-value="fixedTarget"
      :options="availableTargets"
      narrow
      disabled
    />

    <input
      class="input input-mono symbols-input"
      :value="localSymbols"
      :placeholder="isNFA ? 'a, b, ε' : 'a, b'"
      @focus="inputFocused = true"
      @blur="onFixedBlur"
      @input="onFixedInput"
    >
  </div>

  <!-- Existing group (NFA) -->
  <div
    v-else-if="transitions.length > 0"
    class="transition-row"
  >
    <TargetSelect
      :model-value="transitions[0].targetId"
      :options="availableTargets"
      narrow
      @update:model-value="onTargetChange"
    />

    <input
      ref="existingSymbolsRef"
      class="input input-mono symbols-input"
      :value="displaySymbols"
      :placeholder="isNFA ? 'a, b, ε' : 'a, b'"
      @change="onSymbolsChange"
      @keydown.enter="($event.target as HTMLInputElement).blur()"
    >

    <button
      v-if="isNFA"
      class="btn btn-ghost btn-icon"
      title="Add ε transition"
      @click="addEpsilonToExisting"
    >
      ε
    </button>

    <button
      class="btn btn-ghost btn-icon"
      title="Remove transitions"
      @click="removeGroup"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
      >
        <path
          d="M3 3l8 8M11 3l-8 8"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>

  <!-- New row (NFA) -->
  <div
    v-else
    class="transition-row"
  >
    <TargetSelect
      :model-value="newTarget"
      :options="availableTargets"
      narrow
      @update:model-value="onNewTargetChange"
    />

    <input
      class="input input-mono symbols-input"
      :value="newSymbols"
      :placeholder="isNFA ? 'a, b, ε' : 'a, b'"
      @input="onNewSymbolsInput"
    >

    <button
      v-if="isNFA"
      class="btn btn-ghost btn-icon"
      title="Add ε transition"
      @click="addEpsilonToNew"
    >
      ε
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Transition } from "~/types/automaton";
import { AutomatonType, EPSILON } from "~/types/automaton";
import { useAutomatonStore } from "~/stores/automaton";

const props = defineProps<{
  sourceId: string;
  transitions: Transition[];
  fixedTarget?: string;
}>();

const automaton = useAutomatonStore();

const isNFA = computed(() => automaton.type === AutomatonType.NFA);

const availableTargets = computed(() => automaton.states);

const displaySymbols = computed(() =>
  props.transitions.map(t => t.symbol).join(", "),
);

// --- DFA fixed-target row ---

const localSymbols = ref(displaySymbols.value);
const inputFocused = ref(false);

watch(displaySymbols, (val) => {
  if (!inputFocused.value) {
    localSymbols.value = val;
  }
});

function onFixedInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  localSymbols.value = raw;
  syncFixedSymbols(raw);
}

function onFixedBlur() {
  inputFocused.value = false;
  localSymbols.value = displaySymbols.value;
}

function syncFixedSymbols(raw: string) {
  if (!props.fixedTarget) return;
  const parsed = [...new Set(raw.split(",").map(s => s.trim()).filter(s => s.length > 0))];
  const targetId = props.fixedTarget;

  const currentSymbols = new Map<string, string>();
  for (const t of props.transitions) {
    currentSymbols.set(t.symbol, t.id);
  }

  const newSymbolSet = new Set(parsed);

  const toRemove = props.transitions.filter(t => !newSymbolSet.has(t.symbol)).map(t => t.id);
  if (toRemove.length > 0) {
    automaton.removeTransitions(toRemove);
  }

  for (const symbol of parsed) {
    if (!currentSymbols.has(symbol)) {
      automaton.addTransition(props.sourceId, targetId, symbol);
    }
  }
}

const existingSymbolsRef = ref<HTMLInputElement | null>(null);

/** Append ε to the existing group's symbols if not already present. */
function addEpsilonToExisting() {
  const currentSymbols = props.transitions.map(t => t.symbol);
  if (currentSymbols.includes(EPSILON)) return;
  const targetId = props.transitions[0]?.targetId;
  if (!targetId) return;
  automaton.addTransition(props.sourceId, targetId, EPSILON);
}

// --- NFA existing group handlers ---

function onTargetChange(targetId: string) {
  if (!targetId) return;
  for (const t of props.transitions) {
    automaton.updateTransitionTarget(t.id, targetId);
  }
}

function onSymbolsChange(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const newSymbols = raw.split(",").map(s => s.trim()).filter(s => s.length > 0);
  const targetId = props.transitions[0].targetId;

  const currentSymbols = new Map<string, string>();
  for (const t of props.transitions) {
    currentSymbols.set(t.symbol, t.id);
  }

  const newSymbolSet = new Set(newSymbols);

  const toRemove = props.transitions.filter(t => !newSymbolSet.has(t.symbol)).map(t => t.id);
  if (toRemove.length > 0) {
    automaton.removeTransitions(toRemove);
  }

  for (const symbol of newSymbols) {
    if (!currentSymbols.has(symbol)) {
      automaton.addTransition(props.sourceId, targetId, symbol);
    }
  }

  if (newSymbols.length === 0) {
    const allIds = props.transitions.map(t => t.id);
    automaton.removeTransitions(allIds);
  }
}

function removeGroup() {
  const ids = props.transitions.map(t => t.id);
  automaton.removeTransitions(ids);
}

// --- NFA new row handlers ---

const newTarget = ref("");
const newSymbols = ref("");

function onNewTargetChange(value: string) {
  newTarget.value = value;
  tryCreateTransitions();
}

function onNewSymbolsInput(event: Event) {
  newSymbols.value = (event.target as HTMLInputElement).value;
  tryCreateTransitions();
}

/** Set ε as the symbol for the new row and attempt to create. */
function addEpsilonToNew() {
  if (!newSymbols.value.includes(EPSILON)) {
    newSymbols.value = newSymbols.value ? `${newSymbols.value}, ${EPSILON}` : EPSILON;
  }
  tryCreateTransitions();
}

function tryCreateTransitions() {
  if (!newTarget.value || !newSymbols.value) return;

  const symbols = newSymbols.value.split(",").map(s => s.trim()).filter(s => s.length > 0);
  if (symbols.length === 0) return;

  for (const symbol of symbols) {
    automaton.addTransition(props.sourceId, newTarget.value, symbol);
  }

  newTarget.value = "";
  newSymbols.value = "";
}
</script>
