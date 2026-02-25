<template>
  <div class="transition-grid-wrapper">
    <!-- Summary line -->
    <div class="transition-summary mono">
      {{ summaryText }}
    </div>

    <!-- Grid -->
    <div
      v-if="columns.length > 0 && automaton.states.length > 0"
      class="transition-grid"
      role="grid"
      :style="{ gridTemplateColumns }"
    >
      <!-- Header row -->
      <div class="grid-corner" />
      <div
        v-for="symbol in columns"
        :key="'col-' + symbol"
        class="grid-col-header"
      >
        {{ symbol }}
      </div>

      <!-- One row per target state -->
      <template
        v-for="target in automaton.states"
        :key="target.id"
      >
        <div class="grid-row-header">
          <span
            v-if="target.isStart"
            class="state-icon"
          >→</span>
          <span>{{ target.name }}</span>
          <span
            v-if="target.isAccept"
            class="state-icon"
          >◎</span>
        </div>

        <button
          v-for="symbol in columns"
          :key="target.id + ':' + symbol"
          class="grid-cell"
          :class="cellClasses(target.id, symbol)"
          :aria-label="`${symbol} to ${target.name}`"
          @click="toggleTransition(target.id, symbol)"
        >
          <span class="cell-indicator" />
        </button>
      </template>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="transition-grid-empty mono"
    >
      {{ automaton.states.length === 0 ? 'No states defined' : 'Add symbols to the alphabet' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { AutomatonType, EPSILON } from "~/types/automaton";
import { useAutomatonStore } from "~/stores/automaton";

const props = defineProps<{
  /** The state whose outgoing transitions are being edited. */
  sourceId: string;
}>();

const automaton = useAutomatonStore();

/** Key for tracking swap-out animation. Format: "targetId:symbol". */
const swappingOut = ref<string | null>(null);

/** Grid columns: alphabet symbols + ε for NFA. */
const columns = computed(() => {
  const cols = [...automaton.alphabet];
  if (automaton.type === AutomatonType.NFA) {
    cols.push(EPSILON);
  }
  return cols;
});

/** CSS grid-template-columns: auto-sized row header + equal columns. */
const gridTemplateColumns = computed(() => {
  return `minmax(60px, auto) repeat(${columns.value.length}, minmax(32px, 1fr))`;
});

/** Transitions originating from this state. */
const transitionsFromSource = computed(() => {
  return automaton.getTransitionsFrom(props.sourceId);
});

/** Compact summary of all transitions from this state. */
const summaryText = computed(() => {
  if (transitionsFromSource.value.length === 0) return "No transitions defined";
  const parts = transitionsFromSource.value.map((t) => {
    const targetName = automaton.getState(t.targetId)?.name ?? "?";
    return `${t.symbol} → ${targetName}`;
  });
  return parts.join(", ");
});

/** Check if a transition exists for (source → target) on the given symbol. */
function hasTransition(targetId: string, symbol: string): boolean {
  return transitionsFromSource.value.some(
    t => t.targetId === targetId && t.symbol === symbol,
  );
}

/** Find which target currently owns a symbol (DFA only — at most one). */
function activeTargetForSymbol(symbol: string): string | null {
  const t = transitionsFromSource.value.find(t => t.symbol === symbol);
  return t?.targetId ?? null;
}

/** Build a composite key for animation tracking. */
function cellKey(targetId: string, symbol: string): string {
  return `${targetId}:${symbol}`;
}

/** CSS classes for a grid cell. */
function cellClasses(targetId: string, symbol: string) {
  const active = hasTransition(targetId, symbol);
  const isDFA = automaton.type === AutomatonType.DFA;
  const symbolUsed = isDFA && activeTargetForSymbol(symbol) !== null;
  return {
    "cell-active": active,
    "cell-dimmed": isDFA && symbolUsed && !active,
    "cell-swap-out": swappingOut.value === cellKey(targetId, symbol),
  };
}

/** Toggle a transition on or off. In DFA mode, reassigns if the symbol is already used. */
function toggleTransition(targetId: string, symbol: string) {
  const existing = transitionsFromSource.value.find(
    t => t.targetId === targetId && t.symbol === symbol,
  );

  if (existing) {
    // Deactivate: remove transition
    automaton.removeTransition(existing.id);
    return;
  }

  if (automaton.type === AutomatonType.DFA && symbol !== EPSILON) {
    // DFA: remove existing transition for this symbol (reassign)
    const currentForSymbol = transitionsFromSource.value.find(t => t.symbol === symbol);
    if (currentForSymbol) {
      swappingOut.value = cellKey(currentForSymbol.targetId, symbol);
      setTimeout(() => {
        swappingOut.value = null;
      }, 200);
      automaton.removeTransition(currentForSymbol.id);
    }
  }

  // Activate: add transition
  automaton.addTransition(props.sourceId, targetId, symbol);
}
</script>
