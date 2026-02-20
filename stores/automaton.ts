import { defineStore } from 'pinia'
import type {
  Automaton,
  AutomatonExport,
  AutomatonState,
  AutomatonType,
  Position,
  Transition,
} from '~/types/automaton'

/**
 * Input data representing a formal 5-tuple automaton definition.
 *
 * Used by {@link buildFromTuple} to construct the full automaton
 * (states with positions, transitions with IDs) from a textbook-style
 * specification.
 */
export interface TupleData {
  /** Display name for the automaton. Defaults to "Untitled DFA" / "Untitled NFA". */
  name?: string
  /** Whether this is a DFA or NFA. */
  type: AutomatonType
  /** Ordered list of state names (Q). */
  states: string[]
  /** Input alphabet symbols (Σ). */
  alphabet: string[]
  /** Name of the start state (q₀). Must be a member of {@link states}. */
  startState: string
  /** Names of accepting states (F). Each must be a member of {@link states}. */
  acceptStates: string[]
  /** Transition function (δ): `transitions[sourceName][symbol] = targetNames[]`. */
  transitions: Record<string, Record<string, string[]>>
}
import { createId } from '~/utils/ids'
import { computeLayout } from '~/utils/layout'
import type { LayoutTransition } from '~/utils/layout'

/**
 * Convert the tuple's nested transition map into flat index-based edges
 * suitable for the layout algorithm.
 *
 * Symbols are discarded — layout only cares about connectivity.
 *
 * @param tupleTransitions - The `δ` map from {@link TupleData}.
 * @param nameToIndex      - Mapping from state name to its index in the states array.
 * @returns Flat array of directed edges by index.
 */
function buildLayoutTransitions(
  tupleTransitions: TupleData['transitions'],
  nameToIndex: Map<string, number>,
): LayoutTransition[] {
  const result: LayoutTransition[] = []
  for (const [sourceName, symbolMap] of Object.entries(tupleTransitions)) {
    const si = nameToIndex.get(sourceName)
    if (si === undefined) continue
    for (const targets of Object.values(symbolMap)) {
      for (const targetName of targets) {
        const ti = nameToIndex.get(targetName)
        if (ti === undefined) continue
        result.push({ sourceIndex: si, targetIndex: ti })
      }
    }
  }
  return result
}

/**
 * Create {@link AutomatonState} objects from tuple data and computed positions.
 *
 * Each state receives a unique ID, its layout position, and its start/accept
 * flags derived from the tuple definition.
 *
 * @param data      - The full tuple input.
 * @param positions - Position array from {@link computeLayout}, parallel to `data.states`.
 * @returns The created states and a name→ID lookup for wiring transitions.
 */
function buildStates(
  data: TupleData,
  positions: Position[],
): { states: AutomatonState[], nameToId: Map<string, string> } {
  const states: AutomatonState[] = []
  const nameToId = new Map<string, string>()
  for (let i = 0; i < data.states.length; i++) {
    const name = data.states[i]
    const state: AutomatonState = {
      id: createId(),
      name,
      position: positions[i],
      isStart: name === data.startState,
      isAccept: data.acceptStates.includes(name),
    }
    states.push(state)
    nameToId.set(name, state.id)
  }
  return { states, nameToId }
}

/**
 * Create {@link Transition} objects by resolving state names to their
 * generated IDs.
 *
 * Produces one Transition per (source, symbol, target) triple.
 *
 * @param tupleTransitions - The `δ` map from {@link TupleData}.
 * @param nameToId         - Mapping from state name to generated ID (from {@link buildStates}).
 * @returns Array of store-ready Transition objects.
 */
function buildTransitions(
  tupleTransitions: TupleData['transitions'],
  nameToId: Map<string, string>,
): Transition[] {
  const transitions: Transition[] = []
  for (const [sourceName, symbolMap] of Object.entries(tupleTransitions)) {
    const sourceId = nameToId.get(sourceName)
    if (!sourceId) continue
    for (const [symbol, targets] of Object.entries(symbolMap)) {
      for (const targetName of targets) {
        const targetId = nameToId.get(targetName)
        if (!targetId) continue
        transitions.push({ id: createId(), sourceId, targetId, symbol })
      }
    }
  }
  return transitions
}

export const useAutomatonStore = defineStore('automaton', {
  state: (): Automaton => ({
    id: createId(),
    name: 'Untitled DFA',
    type: 'DFA',
    alphabet: [],
    states: [],
    transitions: [],
  }),

  getters: {
    /** The designated start state, or `undefined` if no states exist. */
    startState(): AutomatonState | undefined {
      return this.states.find(s => s.isStart)
    },

    /** Look up a state by its unique ID. */
    getState() {
      return (id: string): AutomatonState | undefined => {
        return this.states.find(s => s.id === id)
      }
    },

    /** Return all transitions originating from the given state. */
    getTransitionsFrom() {
      return (stateId: string): Transition[] => {
        return this.transitions.filter(t => t.sourceId === stateId)
      }
    },

    /** Find the transition between two specific states (if any). */
    getTransitionBetween() {
      return (sourceId: string, targetId: string): Transition | undefined => {
        return this.transitions.find(t => t.sourceId === sourceId && t.targetId === targetId)
      }
    },

    /** Check if a reverse transition exists (target → source). Used for curved bidirectional arrow rendering. */
    hasBidirectional() {
      return (sourceId: string, targetId: string): boolean => {
        return this.transitions.some(t => t.sourceId === targetId && t.targetId === sourceId)
      }
    },

    /** Generate the next available state name in the `q0, q1, q2, ...` sequence. */
    nextStateName(): string {
      const existing = this.states.map((s) => {
        const match = new RegExp(/^q(\d+)$/).exec(s.name)
        return match ? Number.parseInt(match[1]) : -1
      })
      const max = existing.length > 0 ? Math.max(...existing) : -1
      return `q${max + 1}`
    },
  },

  actions: {
    /** Add a new state at the given canvas position. The first state added is automatically marked as start. */
    addState(position: Position): AutomatonState {
      const isFirst = this.states.length === 0
      const state: AutomatonState = {
        id: createId(),
        name: this.nextStateName,
        position,
        isStart: isFirst,
        isAccept: false,
      }
      this.states.push(state)
      return state
    },

    /** Remove a state and all transitions connected to it. */
    removeState(id: string) {
      this.states = this.states.filter(s => s.id !== id)
      this.transitions = this.transitions.filter(
        t => t.sourceId !== id && t.targetId !== id,
      )
    },

    /** Update mutable properties (name, position, isAccept) of an existing state. */
    updateState(id: string, updates: Partial<Pick<AutomatonState, 'name' | 'position' | 'isAccept'>>) {
      const state = this.states.find(s => s.id === id)
      if (!state) return
      Object.assign(state, updates)
    },

    /** Designate a state as the start state, clearing the flag on all others. */
    setStartState(id: string) {
      for (const s of this.states) {
        s.isStart = s.id === id
      }
    },

    /** Create a new transition edge between two states for the given symbol. */
    addTransition(sourceId: string, targetId: string, symbol: string): Transition {
      const transition: Transition = {
        id: createId(),
        sourceId,
        targetId,
        symbol,
      }
      this.transitions.push(transition)
      return transition
    },

    /** Delete a transition by ID. */
    removeTransition(id: string) {
      this.transitions = this.transitions.filter(t => t.id !== id)
    },

    /** Change the symbol on an existing transition. */
    updateTransitionSymbol(id: string, symbol: string) {
      const transition = this.transitions.find(t => t.id === id)
      if (transition) {
        transition.symbol = symbol
      }
    },

    /** Redirect an existing transition to a different target state. */
    updateTransitionTarget(id: string, targetId: string) {
      const transition = this.transitions.find(t => t.id === id)
      if (transition) {
        transition.targetId = targetId
      }
    },

    /**
     * Replace the entire automaton from a 5-tuple definition.
     *
     * Computes an auto-layout for state positions, generates unique IDs for
     * every entity, and applies the result in a single `$patch` so Vue
     * renders only the final state.
     */
    buildFromTuple(data: TupleData) {
      const nameToIndex = new Map<string, number>()
      for (let i = 0; i < data.states.length; i++) {
        nameToIndex.set(data.states[i], i)
      }

      const layoutTransitions = buildLayoutTransitions(data.transitions, nameToIndex)
      const startIndex = nameToIndex.get(data.startState) ?? 0
      const positions = computeLayout(data.states.length, startIndex, layoutTransitions)

      const { states, nameToId } = buildStates(data, positions)
      const transitions = buildTransitions(data.transitions, nameToId)

      this.$patch({
        id: createId(),
        name: data.name || `Untitled ${data.type}`,
        type: data.type,
        alphabet: [...data.alphabet],
        states,
        transitions,
      })
    },

    /** Reset the automaton to its empty initial state. */
    clear() {
      this.id = createId()
      this.name = 'Untitled DFA'
      this.type = 'DFA'
      this.alphabet = []
      this.states = []
      this.transitions = []
    },

    /** Serialize the automaton to a portable JSON export (deep-copied). */
    exportJSON(): AutomatonExport {
      return {
        version: 1,
        automaton: {
          id: this.id,
          name: this.name,
          type: this.type,
          alphabet: [...this.alphabet],
          states: this.states.map(s => ({ ...s, position: { ...s.position } })),
          transitions: this.transitions.map(t => ({ ...t })),
        },
      }
    },

    /** Load an automaton from a previously exported JSON object. */
    importJSON(data: AutomatonExport) {
      if (data.version !== 1) return
      const a = data.automaton
      this.id = a.id
      this.name = a.name
      this.type = a.type
      this.alphabet = a.alphabet
      this.states = a.states
      this.transitions = a.transitions
    },
  },
})
