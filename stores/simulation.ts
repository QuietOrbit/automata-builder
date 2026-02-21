import { defineStore } from 'pinia'
import type { SimulationHistoryEntry, SimulationState } from '~/types/automaton'
import { SimulationStatus } from '~/types/automaton'
import { useAutomatonStore } from '~/stores/automaton'

/**
 * Step-by-step simulation engine for running input strings through the automaton.
 * Maintains a history stack that enables forward stepping, backward stepping,
 * and run-to-completion with an infinite-loop safety counter.
 */
export const useSimulationStore = defineStore('simulation', {
  state: (): SimulationState => ({
    input: '',
    currentIndex: 0,
    currentStateId: null,
    status: SimulationStatus.Idle,
    history: [],
  }),

  getters: {
    /** Whether the simulation is actively processing input (not finished or idle). */
    isRunning(): boolean {
      return this.status === SimulationStatus.Running
    },

    /** Whether the simulation has reached a terminal state (accepted, rejected, or stuck). */
    isFinished(): boolean {
      return this.status === SimulationStatus.Accepted || this.status === SimulationStatus.Rejected || this.status === SimulationStatus.Stuck
    },

    /** Whether a forward step can be taken (while running, or from idle with a start state). */
    canStep(): boolean {
      if (this.status === SimulationStatus.Running) return true
      if (this.status === SimulationStatus.Idle) {
        const automaton = useAutomatonStore()
        return automaton.startState !== undefined
      }
      return false
    },

    /** Whether a backward step can be taken (requires at least one history entry). */
    canStepBack(): boolean {
      return this.history.length > 0
    },

    /** The next input symbol to be read, or null if all input has been consumed. */
    currentSymbol(): string | null {
      if (this.currentIndex >= this.input.length) return null
      return this.input[this.currentIndex]
    },
  },

  actions: {
    /**
     * Set the input string and reset the simulation to its initial state.
     * @param input - The string to simulate.
     */
    setInput(input: string) {
      this.input = input
      this.reset()
    },

    /**
     * Reset the simulation to idle, clearing all state and history.
     * Use Step or Run to re-initialize from the start state.
     */
    reset() {
      this.currentIndex = 0
      this.currentStateId = null
      this.history = []
      this.status = SimulationStatus.Idle
    },

    /**
     * Advance the simulation by one symbol. If idle, initializes at the start
     * state first. Finds a matching transition from the current state, records
     * the step in history, and moves to the target state. If no transition
     * matches, the simulation enters the stuck state.
     */
    step() {
      // If idle, initialize simulation at the start state
      if (this.status === SimulationStatus.Idle) {
        const automaton = useAutomatonStore()
        const start = automaton.startState
        if (!start) return
        this.currentStateId = start.id
        this.currentIndex = 0
        this.history = []

        if (this.input.length === 0) {
          this.status = start.isAccept ? SimulationStatus.Accepted : SimulationStatus.Rejected
        } else {
          this.status = SimulationStatus.Running
        }
        return
      }

      if (this.status !== SimulationStatus.Running || this.currentStateId === null) return

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
        this.status = SimulationStatus.Stuck
        return
      }

      // Move to next state
      this.currentStateId = match.targetId
      this.currentIndex++

      // Check if we've consumed all input
      if (this.currentIndex >= this.input.length) {
        const currentState = automaton.getState(this.currentStateId)
        this.status = currentState?.isAccept ? SimulationStatus.Accepted : SimulationStatus.Rejected
      }
    },

    /**
     * Undo the most recent step by popping from the history stack.
     * Restores the previous state and input position, returning to running status.
     */
    stepBack() {
      if (this.history.length === 0) return

      const entry = this.history.pop()!
      this.currentStateId = entry.stateId
      this.currentIndex = Math.max(0, this.currentIndex - (entry.symbolRead === null ? 0 : 1))
      this.status = SimulationStatus.Running
    },

    /**
     * Repeatedly step forward until the simulation finishes or a safety
     * counter (10,000 iterations) is reached to prevent infinite loops.
     */
    runToEnd() {
      // Initialize from idle if needed
      if (this.status === SimulationStatus.Idle) {
        this.step()
      }
      let safetyCounter = 10000
      while (this.status === SimulationStatus.Running && safetyCounter > 0) {
        this.step()
        safetyCounter--
      }
    },
  },
})
