<template>
  <div class="tuple-builder">
    <h3 class="editor-title">5-Tuple Definition</h3>

    <!-- Name -->
    <div class="field">
      <label class="field-label" for="tuple-name">Name</label>
      <input
        id="tuple-name"
        class="input"
        v-model="nameInput"
        placeholder="My Automaton"
      />
    </div>

    <!-- Q (States) -->
    <div class="field">
      <label class="field-label" for="tuple-states">Q (States)</label>
      <input
        id="tuple-states"
        class="input input-mono"
        v-model="statesInput"
        placeholder="q0, q1, q2"
        @blur="syncStatesFromInput"
      />
    </div>

    <!-- Σ (Alphabet) — read-only, derived from transitions -->
    <div class="field">
      <span class="field-label">&Sigma; (Alphabet)</span>
      <div class="input input-mono tuple-readonly">
        {{ automaton.alphabet.length > 0 ? automaton.alphabet.join(', ') : '(empty)' }}
      </div>
    </div>

    <!-- q₀ (Start State) -->
    <div class="field">
      <label class="field-label" for="tuple-start">q&#8320; (Start State)</label>
      <select id="tuple-start" class="select" :value="currentStartName" @change="onStartChange">
        <option value="" disabled>Select start state</option>
        <option v-for="s in automaton.states" :key="s.id" :value="s.name">{{ s.name }}</option>
      </select>
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
    <div class="field" v-if="automaton.states.length > 0 && tableColumns.length > 0">
      <span class="field-label">&delta; (Transition Table)</span>
      <div class="tuple-table-wrapper">
        <table class="tuple-table">
          <thead>
            <tr>
              <th class="tuple-table-corner">&delta;</th>
              <th v-for="col in tableColumns" :key="col" class="mono">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="state in automaton.states" :key="state.id">
              <td class="tuple-table-row-header mono">{{ state.name }}</td>
              <td v-for="col in tableColumns" :key="col" class="tuple-table-cell">
                <!-- DFA: single select -->
                <select
                  v-if="automaton.type === AutomatonType.DFA"
                  class="tuple-cell-select"
                  :value="getDFATarget(state.id, col)"
                  @change="setDFATransition(state.id, col, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">-</option>
                  <option v-for="t in automaton.states" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
                <!-- NFA: multi-select dropdown -->
                <div v-else class="tuple-cell-multi" @click="openDropdown(state.id, col, $event)">
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
    ></div>
    <div
      v-if="dropdown.open"
      class="tuple-dropdown"
      :style="{ top: dropdown.y + 'px', left: dropdown.x + 'px' }"
    >
      <label v-for="s in automaton.states" :key="s.id" class="tuple-dropdown-item">
        <input
          type="checkbox"
          :checked="hasNFATarget(dropdown.sourceId, dropdown.symbol, s.id)"
          @change="toggleNFATarget(dropdown.sourceId, dropdown.symbol, s.id)"
        />
        <span class="mono">{{ s.name }}</span>
      </label>
    </div>

    <!-- Re-layout button -->
    <button class="btn btn-ghost btn-full" @click="relayout">Re-layout States</button>
  </div>
</template>

<script setup lang="ts">
import { useAutomatonStore } from '~/stores/automaton'
import { useSimulationStore } from '~/stores/simulation'
import { useViewportStore } from '~/stores/viewport'
import { AutomatonType, EPSILON } from '~/types/automaton'
import { computeLayout } from '~/utils/layout'
import type { LayoutTransition } from '~/utils/layout'
import { buildVisualInfosFromStore, resolveCollisions } from '~/utils/collision'

const automaton = useAutomatonStore()
const simulation = useSimulationStore()
const viewport = useViewportStore()

// --- Name sync ---

const nameInput = ref(automaton.name)

watch(() => automaton.name, (val) => {
  nameInput.value = val
})

watch(nameInput, (value) => {
  automaton.name = value.trim() || `Untitled ${automaton.type}`
})

// --- States sync ---

const statesInput = ref(automaton.states.map(s => s.name).join(', '))

// Update the text field when store states change (e.g., from canvas edits)
watch(
  () => automaton.states.map(s => s.name).join(', '),
  (val) => {
    // Only sync if the input isn't focused (avoid overwriting user typing)
    if (document.activeElement?.id !== 'tuple-states') {
      statesInput.value = val
    }
  },
)

/**
 * On blur, diff the states input against the store.
 * Add new states and remove missing ones.
 */
function syncStatesFromInput() {
  const parsed = statesInput.value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  const existingNames = new Set(automaton.states.map(s => s.name))
  const desiredNames = new Set(parsed)

  // Find the bounding box of existing states for auto-positioning
  let maxX = 0
  let maxY = 0
  for (const s of automaton.states) {
    if (s.position.x > maxX) maxX = s.position.x
    if (s.position.y > maxY) maxY = s.position.y
  }

  // Add new states
  let offset = 0
  for (const name of parsed) {
    if (!existingNames.has(name)) {
      const state = automaton.addState({
        x: maxX + 150 + offset * 150,
        y: maxY,
      })
      automaton.updateState(state.id, { name })
      offset++
    }
  }

  // Remove states not in the desired set
  const toRemove = automaton.states.filter(s => !desiredNames.has(s.name))
  for (const s of toRemove) {
    automaton.removeState(s.id)
  }

  // Update the input to reflect actual store state
  statesInput.value = automaton.states.map(s => s.name).join(', ')
}

// --- Start state ---

const currentStartName = computed(() => {
  return automaton.startState?.name ?? ''
})

function onStartChange(event: Event) {
  const name = (event.target as HTMLSelectElement).value
  const state = automaton.states.find(s => s.name === name)
  if (state) {
    automaton.setStartState(state.id)
  }
}

// --- Accept states ---

function toggleAccept(id: string) {
  const state = automaton.getState(id)
  if (!state) return
  automaton.updateState(id, { isAccept: !state.isAccept })
}

// --- Transition table ---

/** Columns: alphabet symbols + ε for NFA mode. */
const tableColumns = computed(() => {
  const cols = [...automaton.alphabet]
  if (automaton.type === AutomatonType.NFA) cols.push(EPSILON)
  return cols
})

/** Get the DFA target state ID for a (sourceId, symbol) cell. */
function getDFATarget(sourceId: string, symbol: string): string {
  const t = automaton.transitions.find(
    tr => tr.sourceId === sourceId && tr.symbol === symbol,
  )
  return t?.targetId ?? ''
}

/** Set DFA transition: replaces existing or creates new. */
function setDFATransition(sourceId: string, symbol: string, targetId: string) {
  if (!targetId) {
    // Remove existing transition for this (source, symbol)
    const existing = automaton.transitions.filter(
      t => t.sourceId === sourceId && t.symbol === symbol,
    )
    automaton.removeTransitions(existing.map(t => t.id))
    return
  }
  automaton.addTransition(sourceId, targetId, symbol)
}

/** Format the NFA targets for display. */
function getNFADisplay(sourceId: string, symbol: string): string {
  const targets = automaton.transitions
    .filter(t => t.sourceId === sourceId && t.symbol === symbol)
    .map(t => automaton.getState(t.targetId)?.name)
    .filter((n): n is string => n != null)
  if (targets.length === 0) return '-'
  return `{${targets.join(',')}}`
}

/** Check if a specific target exists for (sourceId, symbol) in NFA. */
function hasNFATarget(sourceId: string, symbol: string, targetId: string): boolean {
  return automaton.transitions.some(
    t => t.sourceId === sourceId && t.symbol === symbol && t.targetId === targetId,
  )
}

/** Toggle an NFA transition target for a (sourceId, symbol) cell. */
function toggleNFATarget(sourceId: string, symbol: string, targetId: string) {
  const existing = automaton.transitions.find(
    t => t.sourceId === sourceId && t.symbol === symbol && t.targetId === targetId,
  )
  if (existing) {
    automaton.removeTransition(existing.id)
  } else {
    automaton.addTransition(sourceId, targetId, symbol)
  }
}

// --- NFA dropdown ---

const dropdown = ref({
  open: false,
  sourceId: '',
  symbol: '',
  x: 0,
  y: 0,
})

function openDropdown(sourceId: string, symbol: string, event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dropdown.value = {
    open: true,
    sourceId,
    symbol,
    x: rect.left,
    y: rect.bottom + 2,
  }
}

function closeDropdown() {
  dropdown.value.open = false
}

// --- Re-layout ---

/** Recompute state positions from graph topology, resolve visual overlaps, and fit to view. */
function relayout() {
  if (automaton.states.length === 0) return

  const idToIndex = new Map<string, number>()
  for (let i = 0; i < automaton.states.length; i++) {
    idToIndex.set(automaton.states[i].id, i)
  }

  const layoutTransitions: LayoutTransition[] = automaton.transitions
    .map(t => ({
      sourceIndex: idToIndex.get(t.sourceId)!,
      targetIndex: idToIndex.get(t.targetId)!,
    }))
    .filter(lt => lt.sourceIndex !== undefined && lt.targetIndex !== undefined)

  const startIndex = idToIndex.get(automaton.startState?.id ?? automaton.states[0].id) ?? 0
  const positions = computeLayout(automaton.states.length, startIndex, layoutTransitions)

  // Resolve visual overlaps before applying positions
  const visualInfos = buildVisualInfosFromStore(automaton.states, automaton.transitions)
  resolveCollisions(positions, visualInfos)

  for (let i = 0; i < automaton.states.length; i++) {
    automaton.updateState(automaton.states[i].id, { position: positions[i] })
  }

  viewport.requestFitToContent()
}

// --- Simulation reset on structural changes ---

watch(
  () => [automaton.states.length, automaton.transitions.length, automaton.type] as const,
  () => {
    if (simulation.status !== 'idle') {
      simulation.reset()
    }
  },
)
</script>
