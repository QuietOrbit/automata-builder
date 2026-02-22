import { defineStore } from "pinia";
import type { SimulationHistoryEntry, SimulationState, Transition } from "~/types/automaton";
import { AutomatonType, EPSILON, SimulationStatus } from "~/types/automaton";
import { useAutomatonStore } from "~/stores/automaton";

/**
 * Compute the epsilon-closure of a set of state IDs.
 * Follows all ε-transitions reachable from the given states via BFS.
 *
 * @param stateIds    - Starting state IDs.
 * @param transitions - All transitions in the automaton.
 * @returns Array of all state IDs reachable via zero or more ε-transitions.
 */
function epsilonClosure(stateIds: string[], transitions: Transition[]): string[] {
  const closure = new Set(stateIds);
  const queue = [...stateIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const t of transitions) {
      if (t.sourceId === current && t.symbol === EPSILON && !closure.has(t.targetId)) {
        closure.add(t.targetId);
        queue.push(t.targetId);
      }
    }
  }

  return [...closure];
}

/**
 * Step-by-step simulation engine for running input strings through the automaton.
 * Supports both DFA and NFA simulation. Maintains a history stack that enables
 * forward stepping, backward stepping, and run-to-completion with a safety counter.
 */
export const useSimulationStore = defineStore("simulation", {
  state: (): SimulationState => ({
    input: "",
    currentIndex: 0,
    currentStateIds: [],
    status: SimulationStatus.Idle,
    history: [],
  }),

  getters: {
    /** Whether the simulation is actively processing input (not finished or idle). */
    isRunning(): boolean {
      return this.status === SimulationStatus.Running;
    },

    /** Whether the simulation has reached a terminal state (accepted, rejected, or stuck). */
    isFinished(): boolean {
      return this.status === SimulationStatus.Accepted || this.status === SimulationStatus.Rejected || this.status === SimulationStatus.Stuck;
    },

    /** Whether a forward step can be taken (while running, or from idle with a start state). */
    canStep(): boolean {
      if (this.status === SimulationStatus.Running) return true;
      if (this.status === SimulationStatus.Idle) {
        const automaton = useAutomatonStore();
        return automaton.startState !== undefined;
      }
      return false;
    },

    /** Whether a backward step can be taken (requires at least one history entry). */
    canStepBack(): boolean {
      return this.history.length > 0;
    },

    /** The next input symbol to be read, or null if all input has been consumed. */
    currentSymbol(): string | null {
      if (this.currentIndex >= this.input.length) return null;
      return this.input[this.currentIndex];
    },
  },

  actions: {
    /**
     * Set the input string and reset the simulation to its initial state.
     * @param input - The string to simulate.
     */
    setInput(input: string) {
      this.input = input;
      this.reset();
    },

    /**
     * Reset the simulation to idle, clearing all state and history.
     * Use Step or Run to re-initialize from the start state.
     */
    reset() {
      this.currentIndex = 0;
      this.currentStateIds = [];
      this.history = [];
      this.status = SimulationStatus.Idle;
    },

    /**
     * Advance the simulation by one symbol. If idle, initializes at the start
     * state first. Handles both DFA and NFA modes.
     */
    step() {
      const automaton = useAutomatonStore();

      // If idle, initialize simulation at the start state
      if (this.status === SimulationStatus.Idle) {
        const start = automaton.startState;
        if (!start) return;
        this.currentIndex = 0;
        this.history = [];

        if (automaton.type === AutomatonType.NFA) {
          this.currentStateIds = epsilonClosure([start.id], automaton.transitions);
        }
        else {
          this.currentStateIds = [start.id];
        }

        if (this.input.length === 0) {
          const anyAccept = this.currentStateIds.some(id => automaton.getState(id)?.isAccept);
          this.status = anyAccept ? SimulationStatus.Accepted : SimulationStatus.Rejected;
        }
        else {
          this.status = SimulationStatus.Running;
        }
        return;
      }

      if (this.status !== SimulationStatus.Running || this.currentStateIds.length === 0) return;

      const symbol = this.input[this.currentIndex];

      if (automaton.type === AutomatonType.DFA) {
        // DFA: single current state
        const currentId = this.currentStateIds[0];
        const transitions = automaton.getTransitionsFrom(currentId);
        const match = transitions.find(t => t.symbol === symbol);

        const entry: SimulationHistoryEntry = {
          stateIds: [currentId],
          symbolRead: symbol,
          transitionIds: match ? [match.id] : [],
        };
        this.history.push(entry);

        if (!match) {
          this.status = SimulationStatus.Stuck;
          return;
        }

        this.currentStateIds = [match.targetId];
        this.currentIndex++;

        if (this.currentIndex >= this.input.length) {
          const currentState = automaton.getState(match.targetId);
          this.status = currentState?.isAccept ? SimulationStatus.Accepted : SimulationStatus.Rejected;
        }
      }
      else {
        // NFA: multiple current states
        const prevIds = [...this.currentStateIds];
        const matchedTransitionIds: string[] = [];
        const nextStates = new Set<string>();

        for (const stateId of this.currentStateIds) {
          for (const t of automaton.getTransitionsFrom(stateId)) {
            if (t.symbol === symbol) {
              nextStates.add(t.targetId);
              matchedTransitionIds.push(t.id);
            }
          }
        }

        const entry: SimulationHistoryEntry = {
          stateIds: prevIds,
          symbolRead: symbol,
          transitionIds: matchedTransitionIds,
        };
        this.history.push(entry);

        if (nextStates.size === 0) {
          this.currentStateIds = [];
          this.status = SimulationStatus.Stuck;
          return;
        }

        // Apply epsilon closure to the new state set
        this.currentStateIds = epsilonClosure([...nextStates], automaton.transitions);
        this.currentIndex++;

        if (this.currentIndex >= this.input.length) {
          const anyAccept = this.currentStateIds.some(id => automaton.getState(id)?.isAccept);
          this.status = anyAccept ? SimulationStatus.Accepted : SimulationStatus.Rejected;
        }
      }
    },

    /**
     * Undo the most recent step by popping from the history stack.
     * Restores the previous state(s) and input position, returning to running status.
     */
    stepBack() {
      if (this.history.length === 0) return;

      const entry = this.history.pop()!;
      this.currentStateIds = entry.stateIds;
      this.currentIndex = Math.max(0, this.currentIndex - (entry.symbolRead === null ? 0 : 1));
      this.status = SimulationStatus.Running;
    },

    /**
     * Jump the simulation to a specific input position by replaying from
     * the start state. Uses the same safety counter as runToEnd().
     * If the simulation gets stuck or finishes before reaching the target,
     * it stops at that point.
     *
     * @param targetIndex - The input position to jump to (0-based).
     */
    jumpToPosition(targetIndex: number) {
      if (targetIndex < 0 || targetIndex > this.input.length) return;
      if (targetIndex === this.currentIndex && this.status !== SimulationStatus.Idle) return;

      this.reset();
      this.step(); // Initialize from idle → sets start state

      let safetyCounter = 10000;
      while (this.currentIndex < targetIndex && this.status === SimulationStatus.Running && safetyCounter > 0) {
        this.step();
        safetyCounter--;
      }
    },

    /**
     * Repeatedly step forward until the simulation finishes or a safety
     * counter (10,000 iterations) is reached to prevent infinite loops.
     */
    runToEnd() {
      // Initialize from idle if needed
      if (this.status === SimulationStatus.Idle) {
        this.step();
      }
      let safetyCounter = 10000;
      while (this.status === SimulationStatus.Running && safetyCounter > 0) {
        this.step();
        safetyCounter--;
      }
    },
  },
});
