import { defineStore } from 'pinia'
import type {
  Automaton,
  AutomatonExport,
  AutomatonState,
  AutomatonType,
  Position,
  Transition,
} from '~/types/automaton'

export interface TupleData {
  name?: string
  type: AutomatonType
  states: string[]
  alphabet: string[]
  startState: string
  acceptStates: string[]
  /** transitions[sourceName][symbol] = array of target state names */
  transitions: Record<string, Record<string, string[]>>
}
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
      return (id: string): AutomatonState | undefined => {
        return this.states.find(s => s.id === id)
      }
    },

    getTransitionsFrom() {
      return (stateId: string): Transition[] => {
        return this.transitions.filter(t => t.sourceId === stateId)
      }
    },

    getTransitionBetween() {
      return (sourceId: string, targetId: string): Transition | undefined => {
        return this.transitions.find(t => t.sourceId === sourceId && t.targetId === targetId)
      }
    },

    /** Check if a reverse transition exists (target -> source) */
    hasBidirectional() {
      return (sourceId: string, targetId: string): boolean => {
        return this.transitions.some(t => t.sourceId === targetId && t.targetId === sourceId)
      }
    },

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

    removeState(id: string) {
      this.states = this.states.filter(s => s.id !== id)
      this.transitions = this.transitions.filter(
        t => t.sourceId !== id && t.targetId !== id,
      )
    },

    updateState(id: string, updates: Partial<Pick<AutomatonState, 'name' | 'position' | 'isAccept'>>) {
      const state = this.states.find(s => s.id === id)
      if (!state) return
      Object.assign(state, updates)
    },

    setStartState(id: string) {
      for (const s of this.states) {
        s.isStart = s.id === id
      }
    },

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

    removeTransition(id: string) {
      this.transitions = this.transitions.filter(t => t.id !== id)
    },

    updateTransitionSymbol(id: string, symbol: string) {
      const transition = this.transitions.find(t => t.id === id)
      if (transition) {
        transition.symbol = symbol
      }
    },

    updateTransitionTarget(id: string, targetId: string) {
      const transition = this.transitions.find(t => t.id === id)
      if (transition) {
        transition.targetId = targetId
      }
    },

    buildFromTuple(data: TupleData) {
      // Compute all data upfront before mutating store
      const count = data.states.length
      const radius = Math.max(150, (80 * count) / Math.PI)
      const nameToId = new Map<string, string>()
      const states: AutomatonState[] = []
      const transitions: Transition[] = []

      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / count
        const state: AutomatonState = {
          id: createId(),
          name: data.states[i],
          position: {
            x: Math.round(radius * Math.cos(angle)),
            y: Math.round(radius * Math.sin(angle)),
          },
          isStart: data.states[i] === data.startState,
          isAccept: data.acceptStates.includes(data.states[i]),
        }
        states.push(state)
        nameToId.set(data.states[i], state.id)
      }

      for (const [sourceName, symbolMap] of Object.entries(data.transitions)) {
        const sourceId = nameToId.get(sourceName)
        if (!sourceId) continue
        for (const [symbol, targets] of Object.entries(symbolMap)) {
          for (const targetName of targets) {
            const targetId = nameToId.get(targetName)
            if (!targetId) continue
            transitions.push({
              id: createId(),
              sourceId,
              targetId,
              symbol,
            })
          }
        }
      }

      // Apply all at once so Vue renders only the final state
      this.$patch({
        id: createId(),
        name: data.name || `Untitled ${data.type}`,
        type: data.type,
        alphabet: [...data.alphabet],
        states,
        transitions,
      })
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
          transitions: this.transitions.map(t => ({ ...t })),
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
