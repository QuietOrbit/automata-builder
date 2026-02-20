import { defineStore } from 'pinia'
import type { SimulationHistoryEntry, SimulationState, StateId } from '~/types/automaton'
import { useAutomatonStore } from '~/stores/automaton'

export const useSimulationStore = defineStore('simulation', {
  state: (): SimulationState => ({
    input: '',
    currentIndex: 0,
    currentStateId: null,
    status: 'idle',
    history: [],
  }),

  getters: {
    isRunning(): boolean {
      return this.status === 'running'
    },

    isFinished(): boolean {
      return this.status === 'accepted' || this.status === 'rejected' || this.status === 'stuck'
    },

    canStep(): boolean {
      return this.status === 'running'
    },

    canStepBack(): boolean {
      return this.history.length > 0
    },

    currentSymbol(): string | null {
      if (this.currentIndex >= this.input.length) return null
      return this.input[this.currentIndex]
    },
  },

  actions: {
    setInput(input: string) {
      this.input = input
      this.reset()
    },

    reset() {
      const automaton = useAutomatonStore()
      const start = automaton.startState
      this.currentIndex = 0
      this.currentStateId = start?.id ?? null
      this.history = []

      if (!start) {
        this.status = 'idle'
      } else if (this.input.length === 0) {
        this.status = start.isAccept ? 'accepted' : 'rejected'
      } else {
        this.status = 'running'
      }
    },

    step() {
      if (this.status !== 'running' || this.currentStateId === null) return

      const automaton = useAutomatonStore()
      const symbol = this.input[this.currentIndex]

      // Find matching transition
      const transitions = automaton.getTransitionsFrom(this.currentStateId)
      const match = transitions.find(t => t.symbol === symbol)

      // Save history
      const entry: SimulationHistoryEntry = {
        stateId: this.currentStateId,
        symbolRead: symbol,
        transitionId: match?.id ?? null,
      }
      this.history.push(entry)

      if (!match) {
        this.status = 'stuck'
        return
      }

      // Move to next state
      this.currentStateId = match.targetId
      this.currentIndex++

      // Check if we've consumed all input
      if (this.currentIndex >= this.input.length) {
        const currentState = automaton.getState(this.currentStateId)
        this.status = currentState?.isAccept ? 'accepted' : 'rejected'
      }
    },

    stepBack() {
      if (this.history.length === 0) return

      const entry = this.history.pop()!
      this.currentStateId = entry.stateId
      this.currentIndex = Math.max(0, this.currentIndex - (entry.symbolRead !== null ? 1 : 0))
      this.status = 'running'
    },

    runToEnd() {
      let safetyCounter = 10000
      while (this.status === 'running' && safetyCounter > 0) {
        this.step()
        safetyCounter--
      }
    },
  },
})
