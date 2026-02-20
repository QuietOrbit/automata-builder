import { defineStore } from 'pinia'
import type {
  Automaton,
  AutomatonExport,
  AutomatonState,
  Position,
  StateId,
  Transition,
  TransitionId,
} from '~/types/automaton'
import { createId } from '~/utils/ids'

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
    startState(): AutomatonState | undefined {
      return this.states.find(s => s.isStart)
    },

    getState() {
      return (id: StateId): AutomatonState | undefined => {
        return this.states.find(s => s.id === id)
      }
    },

    getTransitionsFrom() {
      return (stateId: StateId): Transition[] => {
        return this.transitions.filter(t => t.sourceId === stateId)
      }
    },

    getTransitionBetween() {
      return (sourceId: StateId, targetId: StateId): Transition | undefined => {
        return this.transitions.find(t => t.sourceId === sourceId && t.targetId === targetId)
      }
    },

    /** Check if a reverse transition exists (target -> source) */
    hasBidirectional() {
      return (sourceId: StateId, targetId: StateId): boolean => {
        return this.transitions.some(t => t.sourceId === targetId && t.targetId === sourceId)
      }
    },

    nextStateName(): string {
      const existing = this.states.map((s) => {
        const match = s.name.match(/^q(\d+)$/)
        return match ? parseInt(match[1]) : -1
      })
      const max = existing.length > 0 ? Math.max(...existing) : -1
      return `q${max + 1}`
    },
  },

  actions: {
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

    removeState(id: StateId) {
      this.states = this.states.filter(s => s.id !== id)
      this.transitions = this.transitions.filter(
        t => t.sourceId !== id && t.targetId !== id,
      )
    },

    updateState(id: StateId, updates: Partial<Pick<AutomatonState, 'name' | 'position' | 'isAccept'>>) {
      const state = this.states.find(s => s.id === id)
      if (!state) return
      Object.assign(state, updates)
    },

    setStartState(id: StateId) {
      for (const s of this.states) {
        s.isStart = s.id === id
      }
    },

    addTransition(sourceId: StateId, targetId: StateId, symbols: string[]): Transition {
      // Check if transition already exists for this source-target pair
      const existing = this.transitions.find(
        t => t.sourceId === sourceId && t.targetId === targetId,
      )
      if (existing) {
        // Merge symbols
        const newSymbols = symbols.filter(s => !existing.symbols.includes(s))
        existing.symbols.push(...newSymbols)
        return existing
      }

      const transition: Transition = {
        id: createId(),
        sourceId,
        targetId,
        symbols,
      }
      this.transitions.push(transition)
      return transition
    },

    removeTransition(id: TransitionId) {
      this.transitions = this.transitions.filter(t => t.id !== id)
    },

    updateTransitionSymbols(id: TransitionId, symbols: string[]) {
      const transition = this.transitions.find(t => t.id === id)
      if (transition) {
        transition.symbols = symbols
      }
    },

    updateTransitionTarget(id: TransitionId, targetId: StateId) {
      const transition = this.transitions.find(t => t.id === id)
      if (transition) {
        transition.targetId = targetId
      }
    },

    setAlphabet(symbols: string[]) {
      this.alphabet = symbols
    },

    clear() {
      this.id = createId()
      this.name = 'Untitled DFA'
      this.type = 'DFA'
      this.alphabet = []
      this.states = []
      this.transitions = []
    },

    exportJSON(): AutomatonExport {
      return {
        version: 1,
        automaton: {
          id: this.id,
          name: this.name,
          type: this.type,
          alphabet: [...this.alphabet],
          states: this.states.map(s => ({ ...s, position: { ...s.position } })),
          transitions: this.transitions.map(t => ({ ...t, symbols: [...t.symbols] })),
        },
      }
    },

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
