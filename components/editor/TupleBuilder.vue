<template>
  <div class="tuple-builder">
    <h3 class="editor-title">Build from 5-Tuple</h3>

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

    <!-- Type selector -->
    <div class="field">
      <span class="field-label">Type</span>
      <div class="tuple-type-toggle">
        <button
          class="btn btn-sm"
          :class="type === 'DFA' ? 'btn-primary' : 'btn-ghost'"
          @click="type = 'DFA'"
        >DFA</button>
        <button
          class="btn btn-sm"
          :class="type === 'NFA' ? 'btn-primary' : 'btn-ghost'"
          @click="type = 'NFA'"
        >NFA</button>
      </div>
    </div>

    <!-- Q (States) -->
    <div class="field">
      <label class="field-label" for="tuple-states">Q (States)</label>
      <input
        id="tuple-states"
        class="input input-mono"
        v-model="statesInput"
        placeholder="q0, q1, q2"
      />
    </div>

    <!-- Σ (Alphabet) -->
    <div class="field">
      <label class="field-label" for="tuple-alphabet">&Sigma; (Alphabet)</label>
      <input
        id="tuple-alphabet"
        class="input input-mono"
        v-model="alphabetInput"
        placeholder="a, b"
      />
    </div>

    <!-- q₀ (Start State) -->
    <div class="field">
      <label class="field-label" for="tuple-start">q&#8320; (Start State)</label>
      <select id="tuple-start" class="select" v-model="startState">
        <option value="" disabled>Select start state</option>
        <option v-for="s in parsedStates" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <!-- F (Accept States) -->
    <div class="field">
      <span class="field-label">F (Accept States)</span>
      <div class="tuple-checkboxes">
        <label v-for="s in parsedStates" :key="s" class="tuple-checkbox">
          <input type="checkbox" :checked="acceptStates.has(s)" @change="toggleAccept(s)" />
          <span class="mono">{{ s }}</span>
        </label>
      </div>
    </div>

    <!-- δ (Transition Table) -->
    <div class="field" v-if="parsedStates.length > 0 && tableColumns.length > 0">
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
            <tr v-for="state in parsedStates" :key="state">
              <td class="tuple-table-row-header mono">{{ state }}</td>
              <td v-for="col in tableColumns" :key="col" class="tuple-table-cell">
                <!-- DFA: single select -->
                <select
                  v-if="type === 'DFA'"
                  class="tuple-cell-select"
                  :value="getTransitionTarget(state, col)"
                  @change="setDFATransition(state, col, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">-</option>
                  <option v-for="t in parsedStates" :key="t" :value="t">{{ t }}</option>
                </select>
                <!-- NFA: multi-select dropdown -->
                <div v-else class="tuple-cell-multi" @click="openDropdown(state, col, $event)">
                  <span class="tuple-cell-multi-text mono">
                    {{ getNFADisplay(state, col) }}
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
      <label v-for="s in parsedStates" :key="s" class="tuple-dropdown-item">
        <input
          type="checkbox"
          :checked="hasNFATarget(dropdown.state, dropdown.symbol, s)"
          @change="toggleNFATarget(dropdown.state, dropdown.symbol, s)"
        />
        <span class="mono">{{ s }}</span>
      </label>
    </div>

    <!-- Validation errors -->
    <div v-if="validationError" class="tuple-error">{{ validationError }}</div>

    <!-- Build button -->
    <button class="btn btn-primary btn-full" @click="build">Build Automaton</button>
  </div>
</template>

<script setup lang="ts">
import { useAutomatonStore } from '~/stores/automaton'
import { useSelectionStore } from '~/stores/selection'
import { useSimulationStore } from '~/stores/simulation'
import type { AutomatonType } from '~/types/automaton'

const automaton = useAutomatonStore()
const selection = useSelectionStore()
const simulation = useSimulationStore()

const nameInput = ref('')
const type = ref<AutomatonType>('DFA')
const statesInput = ref('')
const alphabetInput = ref('')
const startState = ref('')
const acceptStates = ref(new Set<string>())
// transitions[sourceName][symbol] = Set of target names
const transitions = ref(new Map<string, Map<string, Set<string>>>())

/**
 * Sync all local tuple fields from the current automaton store.
 *
 * Reads states, alphabet, start/accept flags, and transitions from the
 * Pinia store and writes them into the component's local refs. Called on
 * mount and reactively whenever the store changes.
 */
function populateFromStore() {
  if (automaton.states.length === 0) return

  nameInput.value = automaton.name
  type.value = automaton.type
  statesInput.value = automaton.states.map(s => s.name).join(', ')
  alphabetInput.value = automaton.alphabet.join(', ')

  const start = automaton.states.find(s => s.isStart)
  startState.value = start?.name ?? ''

  acceptStates.value = new Set(
    automaton.states.filter(s => s.isAccept).map(s => s.name),
  )

  const newTransitions = new Map<string, Map<string, Set<string>>>()
  for (const t of automaton.transitions) {
    const sourceName = automaton.states.find(s => s.id === t.sourceId)?.name
    const targetName = automaton.states.find(s => s.id === t.targetId)?.name
    if (!sourceName || !targetName) continue

    if (!newTransitions.has(sourceName)) {
      newTransitions.set(sourceName, new Map())
    }
    const symbolMap = newTransitions.get(sourceName)!
    if (!symbolMap.has(t.symbol)) {
      symbolMap.set(t.symbol, new Set())
    }
    symbolMap.get(t.symbol)!.add(targetName)
  }
  transitions.value = newTransitions
}

// Re-sync from store on mount and whenever the automaton changes
// (covers both buildFromTuple and direct canvas edits like deleting a transition).
watch(
  () => [automaton.id, automaton.states, automaton.transitions] as const,
  populateFromStore,
  { immediate: true },
)

/** Split the comma-separated states input into trimmed, non-empty names. */
const parsedStates = computed(() => {
  return statesInput.value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
})

/** Split the comma-separated alphabet input into trimmed, non-empty symbols. */
const parsedAlphabet = computed(() => {
  return alphabetInput.value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
})

/** Columns for the transition table: alphabet symbols, plus ε for NFA mode. */
const tableColumns = computed(() => {
  const cols = [...parsedAlphabet.value]
  if (type.value === 'NFA') cols.push('ε')
  return cols
})

// Auto-select start state when states change
watch(parsedStates, (states) => {
  if (states.length > 0 && !states.includes(startState.value)) {
    startState.value = states[0]
  }
  // Clean up accept states
  for (const s of acceptStates.value) {
    if (!states.includes(s)) {
      acceptStates.value.delete(s)
    }
  }
})

/** Toggle a state's membership in the accept states set. */
function toggleAccept(name: string) {
  if (acceptStates.value.has(name)) {
    acceptStates.value.delete(name)
  } else {
    acceptStates.value.add(name)
  }
}

// --- Transition table helpers ---

/**
 * Lazily initialise the nested Map/Set structure for a given (state, symbol)
 * cell and return the target Set.
 */
function ensureTransitionEntry(state: string, symbol: string): Set<string> {
  if (!transitions.value.has(state)) {
    transitions.value.set(state, new Map())
  }
  const stateMap = transitions.value.get(state)!
  if (!stateMap.has(symbol)) {
    stateMap.set(symbol, new Set())
  }
  return stateMap.get(symbol)!
}

/** Get the single DFA target for a (state, symbol) cell, or empty string if unset. */
function getTransitionTarget(state: string, symbol: string): string {
  const targets = transitions.value.get(state)?.get(symbol)
  if (!targets || targets.size === 0) return ''
  return [...targets][0]
}

/** Set the DFA transition for a cell to exactly one target (or clear it). */
function setDFATransition(state: string, symbol: string, target: string) {
  const set = ensureTransitionEntry(state, symbol)
  set.clear()
  if (target) set.add(target)
}

/** Format the NFA target set for display, e.g. `{q1,q2}` or `-` if empty. */
function getNFADisplay(state: string, symbol: string): string {
  const targets = transitions.value.get(state)?.get(symbol)
  if (!targets || targets.size === 0) return '-'
  return `{${[...targets].join(',')}}`
}

/** Check whether a specific target is in the NFA target set for a cell. */
function hasNFATarget(state: string, symbol: string, target: string): boolean {
  return transitions.value.get(state)?.get(symbol)?.has(target) ?? false
}

/** Add or remove a target from the NFA target set for a cell. */
function toggleNFATarget(state: string, symbol: string, target: string) {
  const set = ensureTransitionEntry(state, symbol)
  if (set.has(target)) {
    set.delete(target)
  } else {
    set.add(target)
  }
}

// --- NFA dropdown state ---

/** Tracks the open/close state and screen position of the NFA multi-select dropdown. */
const dropdown = ref({
  open: false,
  state: '',
  symbol: '',
  x: 0,
  y: 0,
})

/** Open the NFA multi-select dropdown anchored below the clicked cell. */
function openDropdown(state: string, symbol: string, event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dropdown.value = {
    open: true,
    state,
    symbol,
    x: rect.left,
    y: rect.bottom + 2,
  }
}

/** Close the NFA multi-select dropdown. */
function closeDropdown() {
  dropdown.value.open = false
}

// --- Validation ---

const validationError = ref('')

/**
 * Validate all tuple fields before building.
 *
 * Checks that Q is non-empty, Σ is non-empty, q₀ is a member of Q,
 * and every accept state is a member of Q. Sets {@link validationError}
 * on failure.
 *
 * @returns `true` if the tuple is valid and ready to build.
 */
function validate(): boolean {
  const states = parsedStates.value
  const alphabet = parsedAlphabet.value

  if (states.length === 0) {
    validationError.value = 'Q must contain at least one state.'
    return false
  }
  if (alphabet.length === 0) {
    validationError.value = 'Σ must contain at least one symbol.'
    return false
  }
  if (!startState.value || !states.includes(startState.value)) {
    validationError.value = 'q₀ must be a state in Q.'
    return false
  }
  for (const s of acceptStates.value) {
    if (!states.includes(s)) {
      validationError.value = `Accept state "${s}" is not in Q.`
      return false
    }
  }
  validationError.value = ''
  return true
}

// --- Build ---

/**
 * Validate inputs, convert local state to {@link TupleData}, and call
 * the store's `buildFromTuple` to replace the current automaton.
 *
 * Clears the active selection and resets the simulation after building.
 */
function build() {
  if (!validate()) return

  // Convert transitions Map to plain object
  const transObj: Record<string, Record<string, string[]>> = {}
  for (const [source, symbolMap] of transitions.value) {
    if (!parsedStates.value.includes(source)) continue
    transObj[source] = {}
    for (const [symbol, targets] of symbolMap) {
      if (!tableColumns.value.includes(symbol)) continue
      const validTargets = [...targets].filter(t => parsedStates.value.includes(t))
      if (validTargets.length > 0) {
        transObj[source][symbol] = validTargets
      }
    }
  }

  automaton.buildFromTuple({
    name: nameInput.value.trim() || undefined,
    type: type.value,
    states: parsedStates.value,
    alphabet: parsedAlphabet.value,
    startState: startState.value,
    acceptStates: [...acceptStates.value],
    transitions: transObj,
  })

  selection.clearSelection()
  simulation.reset()
}
</script>
