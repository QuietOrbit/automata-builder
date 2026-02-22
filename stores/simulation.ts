import { defineStore } from "pinia";
import type { SimulationHistoryEntry, SimulationState, Transition } from "~/types/automaton";
import { AutomatonType, SimulationStatus } from "~/types/automaton";
import { useAutomatonStore } from "~/stores/automaton";
import { epsilonClosure } from "~/utils/epsilon";

/**
 * Determine the final simulation status after all input has been consumed.
 *
 * @param stateIds    - Current state IDs.
 * @param getState    - Lookup function for state data.
 * @returns Accepted if any current state is accepting, Rejected otherwise.
 */
function resolveEndStatus(
  stateIds: string[],
  getState: (id: string) => { isAccept: boolean } | undefined,
): SimulationStatus {
  const anyAccept = stateIds.some(id => getState(id)?.isAccept);
  return anyAccept ? SimulationStatus.Accepted : SimulationStatus.Rejected;
}

/**
 * Advance a DFA simulation by one symbol.
 *
 * @param currentId   - The single current state ID.
 * @param symbol      - The input symbol to read.
 * @param transitions - Transitions from the current state.
 * @returns The history entry and next state ID, or null if stuck.
 */
function advanceDfa(
  currentId: string,
  symbol: string,
  transitions: Transition[],
): { entry: SimulationHistoryEntry; nextStateId: string | null } {
  const match = transitions.find(t => t.symbol === symbol);

  const entry: SimulationHistoryEntry = {
    stateIds: [currentId],
    symbolRead: symbol,
    transitionIds: match ? [match.id] : [],
  };

  return { entry, nextStateId: match ? match.targetId : null };
}

/**
 * Advance an NFA simulation by one symbol.
 *
 * @param currentStateIds   - Set of current state IDs.
 * @param symbol            - The input symbol to read.
 * @param getTransitionsFrom - Function to get transitions from a state.
 * @param allTransitions    - All transitions (needed for epsilon closure).
 * @returns The history entry and next state IDs (empty if stuck).
 */
function advanceNfa(
  currentStateIds: string[],
  symbol: string,
  getTransitionsFrom: (id: string) => Transition[],
  allTransitions: Transition[],
): { entry: SimulationHistoryEntry; nextStateIds: string[] } {
  const prevIds = [...currentStateIds];
  const matchedTransitionIds: string[] = [];
  const nextStates = new Set<string>();

  for (const stateId of currentStateIds) {
    for (const t of getTransitionsFrom(stateId)) {
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

  const nextStateIds = nextStates.size > 0
    ? epsilonClosure([...nextStates], allTransitions)
    : [];

  return { entry, nextStateIds };
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
     * Initialize the simulation from idle state, placing the simulation
     * at the start state. For NFAs, applies epsilon closure.
     *
     * @returns true if initialization succeeded, false if no start state exists.
     */
    initializeFromIdle(): boolean {
      const automaton = useAutomatonStore();
      const start = automaton.startState;
      if (!start) return false;

      this.currentIndex = 0;
      this.history = [];

      this.currentStateIds = automaton.type === AutomatonType.NFA
        ? epsilonClosure([start.id], automaton.transitions)
        : [start.id];

      this.status = this.input.length === 0
        ? resolveEndStatus(this.currentStateIds, automaton.getState)
        : SimulationStatus.Running;

      return true;
    },

    /**
     * Advance the simulation by one symbol. If idle, initializes at the start
     * state first. Handles both DFA and NFA modes.
     */
    step() {
      if (this.status === SimulationStatus.Idle) {
        this.initializeFromIdle();
        return;
      }

      if (this.status !== SimulationStatus.Running || this.currentStateIds.length === 0) return;

      const automaton = useAutomatonStore();
      const symbol = this.input[this.currentIndex];

      if (automaton.type === AutomatonType.DFA) {
        this.stepDfa(symbol);
      }
      else {
        this.stepNfa(symbol);
      }
    },

    /**
     * Process one DFA simulation step for the given input symbol.
     *
     * @param symbol - The input symbol to read.
     */
    stepDfa(symbol: string) {
      const automaton = useAutomatonStore();
      const currentId = this.currentStateIds[0];
      const { entry, nextStateId } = advanceDfa(
        currentId, symbol, automaton.getTransitionsFrom(currentId),
      );

      this.history.push(entry);

      if (!nextStateId) {
        this.status = SimulationStatus.Stuck;
        return;
      }

      this.currentStateIds = [nextStateId];
      this.currentIndex++;

      if (this.currentIndex >= this.input.length) {
        this.status = resolveEndStatus(this.currentStateIds, automaton.getState);
      }
    },

    /**
     * Process one NFA simulation step for the given input symbol.
     *
     * @param symbol - The input symbol to read.
     */
    stepNfa(symbol: string) {
      const automaton = useAutomatonStore();
      const { entry, nextStateIds } = advanceNfa(
        this.currentStateIds, symbol, automaton.getTransitionsFrom, automaton.transitions,
      );

      this.history.push(entry);

      if (nextStateIds.length === 0) {
        this.currentStateIds = [];
        this.status = SimulationStatus.Stuck;
        return;
      }

      this.currentStateIds = nextStateIds;
      this.currentIndex++;

      if (this.currentIndex >= this.input.length) {
        this.status = resolveEndStatus(this.currentStateIds, automaton.getState);
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
