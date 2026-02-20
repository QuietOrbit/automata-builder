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

    /** Whether a forward step can be taken (only possible while running). */
    canStep(): boolean {
      return this.status === SimulationStatus.Running
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
     * Reset the simulation to the beginning of the current input string.
     * Moves back to the start state and clears history. If no start state
     * exists, the simulation enters idle. If the input is empty, the result
     * is immediately determined by the start state's accept flag.
     */
    reset() {
      const automaton = useAutomatonStore()
      const start = automaton.startState
      this.currentIndex = 0
      this.currentStateId = start?.id ?? null
      this.history = []

      if (!start) {
        this.status = SimulationStatus.Idle
      } else if (this.input.length === 0) {
        this.status = start.isAccept ? SimulationStatus.Accepted : SimulationStatus.Rejected
      } else {
        this.status = SimulationStatus.Running
      }
    },

    /**
     * Advance the simulation by one symbol. Finds a matching transition from
     * the current state, records the step in history, and moves to the target
     * state. If no transition matches, the simulation enters the stuck state.
     */
    step() {
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
      let safetyCounter = 10000
      while (this.status === SimulationStatus.Running && safetyCounter > 0) {
        this.step()
        safetyCounter--
      }
    },
  },
})
