<template>
  <div class="tuple-builder">
    <!-- Name -->
    <div class="field">
      <label
        class="field-label"
        for="tuple-name"
      >Name</label>
      <input
        id="tuple-name"
        v-model="nameInput"
        class="input"
        placeholder="My Automaton"
        @blur="handleNameBlur"
      >
    </div>

    <!-- Q (States) -->
    <div class="field">
      <label
        class="field-label"
        for="tuple-states"
      >Q (States)</label>
      <input
        id="tuple-states"
        v-model="statesInput"
        class="input input-mono"
        placeholder="q0, q1, q2"
        @blur="syncStatesFromInput"
      >
    </div>

    <!-- Σ (Alphabet) -->
    <div class="field">
      <span class="field-label">&Sigma; (Alphabet)</span>
      <input
        id="tuple-alphabet"
        v-model="alphabetInput"
        class="input input-mono"
        placeholder="a, b, c"
        @blur="syncAlphabetFromInput"
        @keydown="onAlphabetKeydown"
      >
    </div>

    <!-- q₀ (Start State) -->
    <div class="field">
      <span class="field-label">q&#8320; (Start State)</span>
      <TargetSelect
        :model-value="currentStartId"
        :options="automaton.states"
        placeholder="Select start state"
        @update:model-value="onStartChange"
      />
    </div>

    <!-- F (Accept States) -->
    <div class="field">
      <span class="field-label">F (Accept States)</span>
      <div class="tuple-chips">
        <button
          v-for="s in automaton.states"
          :key="s.id"
          class="tuple-chip mono"
          :class="{ active: s.isAccept }"
          @click="toggleAccept(s.id)"
        >
          {{ s.name }}
        </button>
      </div>
    </div>

    <!-- δ (Transition Table) -->
    <div
      v-if="automaton.states.length > 0 && tableColumns.length > 0"
      class="field"
    >
      <span class="field-label">&delta; (Transition Table)</span>
      <div class="tuple-table-wrapper">
        <table class="tuple-table">
          <thead>
            <tr>
              <th class="tuple-table-corner">
                &delta;
              </th>
              <th
                v-for="col in tableColumns"
                :key="col"
                class="mono"
              >
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="state in automaton.states"
              :key="state.id"
            >
              <td class="tuple-table-row-header mono">
                {{ state.name }}
              </td>
              <td
                v-for="col in tableColumns"
                :key="col"
                class="tuple-table-cell"
              >
                <!-- DFA: single select -->
                <TargetSelect
                  v-if="automaton.type === AutomatonType.DFA"
                  :model-value="getDFATarget(state.id, col)"
                  :options="automaton.states"
                  placeholder="-"
                  compact
                  allow-clear
                  @update:model-value="(val: string) => setDFATransition(state.id, col, val)"
                />
                <!-- NFA: multi-select dropdown -->
                <div
                  v-else
                  class="tuple-cell-multi"
                  @click="openDropdown(state.id, col, $event)"
                >
                  <span class="tuple-cell-multi-text mono">
                    {{ getNFADisplay(state.id, col) }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- NFA dropdown portal -->
    <div
      v-if="dropdown.open"
      class="tuple-dropdown-backdrop"
      @click="closeDropdown"
    />
    <div
      v-if="dropdown.open"
      class="tuple-dropdown"
      :style="{ top: dropdown.y + 'px', left: dropdown.x + 'px' }"
    >
      <div
        v-for="s in automaton.states"
        :key="s.id"
        class="tuple-dropdown-item"
        :class="{ 'is-checked': hasNFATarget(dropdown.sourceId, dropdown.symbol, s.id) }"
        @pointerenter="hoverStore.setHoveredState(s.id)"
        @pointerleave="hoverStore.clearHoveredState()"
        @click="toggleNFATarget(dropdown.sourceId, dropdown.symbol, s.id)"
      >
        <svg
          class="tuple-dropdown-check"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path
            v-if="hasNFATarget(dropdown.sourceId, dropdown.symbol, s.id)"
            d="M3 7l3 3 5-5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="mono">{{ s.name }}</span>
      </div>
    </div>

    <!-- Re-layout button -->
    <button
      class="btn btn-ghost btn-full"
      @click="relayout"
    >
      Re-layout States
    </button>
  </div>
</template>

<script setup lang="ts">
import { useAutomatonStore } from "~/stores/automaton";
import { useHoverStore } from "~/stores/hover";
import { useSimulationStore } from "~/stores/simulation";
import { useViewportStore } from "~/stores/viewport";
import { AutomatonType, EPSILON } from "~/types/automaton";
import { computeLayout } from "~/utils/layout";
import type { LayoutTransition } from "~/utils/layout";
import { buildVisualInfosFromStore, estimateNameLabelWidth, resolveCollisions } from "~/utils/collision";

const automaton = useAutomatonStore();
const hoverStore = useHoverStore();
const simulation = useSimulationStore();
const viewport = useViewportStore();

// --- Name sync ---

const nameInput = ref(automaton.name);

watch(() => automaton.name, (val) => {
  nameInput.value = val;
});

watch(nameInput, (value) => {
  automaton.name = value.trim();
});

/** On blur, restore the default name if the field was left empty. */
function handleNameBlur() {
  if (nameInput.value.trim() === "") {
    automaton.name = `Untitled ${automaton.type}`;
    nameInput.value = automaton.name;
  }
}

// --- States sync ---

const statesInput = ref(automaton.states.map(s => s.name).join(", "));

// Update the text field when store states change (e.g., from canvas edits)
watch(
  () => automaton.states.map(s => s.name).join(", "),
  (val) => {
    // Only sync if the input isn't focused (avoid overwriting user typing)
    if (document.activeElement?.id !== "tuple-states") {
      statesInput.value = val;
    }
  },
);

/**
 * On blur, diff the states input against the store.
 * Add new states and remove missing ones.
 */
function syncStatesFromInput() {
  const parsed = statesInput.value
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const existingNames = new Set(automaton.states.map(s => s.name));
  const desiredNames = new Set(parsed);

  // Find the bounding box of existing states for auto-positioning
  let maxX = 0;
  let maxY = 0;
  for (const s of automaton.states) {
    if (s.position.x > maxX) maxX = s.position.x;
    if (s.position.y > maxY) maxY = s.position.y;
  }

  // Add new states
  let offset = 0;
  for (const name of parsed) {
    if (!existingNames.has(name)) {
      const state = automaton.addState({
        x: maxX + 150 + offset * 150,
        y: maxY,
      });
      automaton.updateState(state.id, { name });
      offset++;
    }
  }

  // Remove states not in the desired set
  const toRemove = automaton.states.filter(s => !desiredNames.has(s.name));
  for (const s of toRemove) {
    automaton.removeState(s.id);
  }

  // Update the input to reflect actual store state
  statesInput.value = automaton.states.map(s => s.name).join(", ");
}

// --- Alphabet sync ---

const alphabetInput = ref(automaton.alphabet.join(", "));

watch(
  () => automaton.alphabet.join(", "),
  (val) => {
    if (document.activeElement?.id !== "tuple-alphabet") {
      alphabetInput.value = val;
    }
  },
);

function syncAlphabetFromInput() {
  const newSymbols = alphabetInput.value
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const removedSymbols = automaton.alphabet.filter(s => !newSymbols.includes(s));
  const affectedTransitions = automaton.transitions.filter(
    t => removedSymbols.includes(t.symbol),
  );

  if (affectedTransitions.length > 0) {
    const count = affectedTransitions.length;
    const syms = removedSymbols.join(", ");
    if (!confirm(`Remove symbol(s) '${syms}'? This will delete ${count} transition(s).`)) {
      alphabetInput.value = automaton.alphabet.join(", ");
      return;
    }
  }

  automaton.setAlphabet(newSymbols);
  alphabetInput.value = automaton.alphabet.join(", ");
}

function onAlphabetKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    syncAlphabetFromInput();
    return;
  }
  if (e.key === ",") {
    syncAlphabetFromInput();
  }
}

// --- Start state ---

const currentStartId = computed(() => {
  return automaton.startState?.id ?? "";
});

function onStartChange(id: string) {
  if (id) {
    automaton.setStartState(id);
  }
}

// --- Accept states ---

function toggleAccept(id: string) {
  const state = automaton.getState(id);
  if (!state) return;
  automaton.updateState(id, { isAccept: !state.isAccept });
}

// --- Transition table ---

/** Columns: alphabet symbols + ε for NFA mode. */
const tableColumns = computed(() => {
  const cols = [...automaton.alphabet];
  if (automaton.type === AutomatonType.NFA) cols.push(EPSILON);
  return cols;
});

/** Get the DFA target state ID for a (sourceId, symbol) cell. */
function getDFATarget(sourceId: string, symbol: string): string {
  const t = automaton.transitions.find(
    tr => tr.sourceId === sourceId && tr.symbol === symbol,
  );
  return t?.targetId ?? "";
}

/** Set DFA transition: replaces existing or creates new. */
function setDFATransition(sourceId: string, symbol: string, targetId: string) {
  if (!targetId) {
    // Remove existing transition for this (source, symbol)
    const existing = automaton.transitions.filter(
      t => t.sourceId === sourceId && t.symbol === symbol,
    );
    automaton.removeTransitions(existing.map(t => t.id));
    return;
  }
  automaton.addTransition(sourceId, targetId, symbol);
}

/** Format the NFA targets for display. */
function getNFADisplay(sourceId: string, symbol: string): string {
  const targets = automaton.transitions
    .filter(t => t.sourceId === sourceId && t.symbol === symbol)
    .map(t => automaton.getState(t.targetId)?.name)
    .filter((n): n is string => n != null);
  if (targets.length === 0) return "-";
  return `{${targets.join(",")}}`;
}

/** Check if a specific target exists for (sourceId, symbol) in NFA. */
function hasNFATarget(sourceId: string, symbol: string, targetId: string): boolean {
  return automaton.transitions.some(
    t => t.sourceId === sourceId && t.symbol === symbol && t.targetId === targetId,
  );
}

/** Toggle an NFA transition target for a (sourceId, symbol) cell. */
function toggleNFATarget(sourceId: string, symbol: string, targetId: string) {
  const existing = automaton.transitions.find(
    t => t.sourceId === sourceId && t.symbol === symbol && t.targetId === targetId,
  );
  if (existing) {
    automaton.removeTransition(existing.id);
  }
  else {
    automaton.addTransition(sourceId, targetId, symbol);
  }
}

// --- NFA dropdown ---

const dropdown = ref({
  open: false,
  sourceId: "",
  symbol: "",
  x: 0,
  y: 0,
});

function openDropdown(sourceId: string, symbol: string, event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  dropdown.value = {
    open: true,
    sourceId,
    symbol,
    x: rect.left,
    y: rect.bottom + 2,
  };
}

function closeDropdown() {
  dropdown.value.open = false;
  hoverStore.clearHoveredState();
}

// --- Re-layout ---

/** Recompute state positions from graph topology, resolve visual overlaps, and fit to view. */
function relayout() {
  if (automaton.states.length === 0) return;

  const idToIndex = new Map<string, number>();
  for (let i = 0; i < automaton.states.length; i++) {
    idToIndex.set(automaton.states[i].id, i);
  }

  const layoutTransitions: LayoutTransition[] = automaton.transitions
    .map(t => ({
      sourceIndex: idToIndex.get(t.sourceId)!,
      targetIndex: idToIndex.get(t.targetId)!,
    }))
    .filter(lt => lt.sourceIndex !== undefined && lt.targetIndex !== undefined);

  const startIndex = idToIndex.get(automaton.startState?.id ?? automaton.states[0].id) ?? 0;
  const maxWidth = Math.max(...automaton.states.map(s => estimateNameLabelWidth(s.name.length)));
  const hSpacing = Math.max(150, maxWidth + 50);
  const vSpacing = Math.max(120, maxWidth / 2 + 60);
  const positions = computeLayout(automaton.states.length, startIndex, layoutTransitions, { hSpacing, vSpacing });

  // Resolve visual overlaps before applying positions
  const visualInfos = buildVisualInfosFromStore(automaton.states, automaton.transitions);
  resolveCollisions(positions, visualInfos, 30);

  for (let i = 0; i < automaton.states.length; i++) {
    automaton.updateState(automaton.states[i].id, { position: positions[i] });
  }

  viewport.requestFitToContent();
}

// --- Simulation reset on structural changes ---

watch(
  () => [automaton.states.length, automaton.transitions.length, automaton.type] as const,
  () => {
    if (simulation.status !== "idle") {
      simulation.reset();
    }
  },
);
</script>
