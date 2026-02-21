/** 2D coordinate on the SVG canvas. */
export interface Position {
  x: number
  y: number
}

/** A state (node) in the automaton, rendered as a circle on the canvas. */
export interface AutomatonState {
  /** Unique identifier for this state. */
  id: string
  /** Display label shown inside the circle (e.g. "q0"). */
  name: string
  /** Canvas position of the state's center. */
  position: Position
  /** Whether this is the designated start state. Exactly one state should be true. */
  isStart: boolean
  /** Whether this is an accepting (final) state, shown with a double ring. */
  isAccept: boolean
}

/** A directed edge in the automaton, connecting a source state to a target on a given symbol. */
export interface Transition {
  /** Unique identifier for this transition. */
  id: string
  /** ID of the state this transition originates from. */
  sourceId: string
  /** ID of the state this transition leads to. */
  targetId: string
  /** The input symbol that triggers this transition. */
  symbol: string
}

/** The epsilon symbol used for NFA epsilon-transitions. */
export const EPSILON = 'ε'

/** Discriminator for the type of automaton. */
export enum AutomatonType {
  DFA = 'DFA',
  NFA = 'NFA',
}

/** Complete automaton definition including all states, transitions, and metadata. */
export interface Automaton {
  /** Unique identifier for this automaton instance. */
  id: string
  /** User-facing name (e.g. "Untitled DFA"). */
  name: string
  /** Whether this automaton is deterministic or nondeterministic. */
  type: AutomatonType
  /** The input alphabet — the set of symbols that transitions may consume. */
  alphabet: string[]
  /** All states in the automaton. */
  states: AutomatonState[]
  /** All transitions (edges) in the automaton. */
  transitions: Transition[]
}

/** Store state for the automaton — same as Automaton but without alphabet (computed via getter). */
export type AutomatonStoreState = Omit<Automaton, 'alphabet'>

/** Tracks progression through the simulation state machine. */
export enum SimulationStatus {
  /** No simulation active (no start state defined). */
  Idle = 'idle',
  /** Simulation is in progress — input has not been fully consumed. */
  Running = 'running',
  /** All input consumed and the current state is an accept state. */
  Accepted = 'accepted',
  /** All input consumed but the current state is not an accept state. */
  Rejected = 'rejected',
  /** No valid transition exists for the current symbol — simulation cannot proceed. */
  Stuck = 'stuck',
}

/** A single step in the simulation history, used for step-back functionality. */
export interface SimulationHistoryEntry {
  /** The state(s) the simulation was in before this step. */
  stateIds: string[]
  /** The input symbol that was read during this step, or null for the initial entry. */
  symbolRead: string | null
  /** The transition(s) that were followed, or empty if the simulation became stuck. */
  transitionIds: string[]
}

/** Complete simulation state for stepping through an input string. */
export interface SimulationState {
  /** The full input string being tested. */
  input: string
  /** Index of the next symbol to read from the input string. */
  currentIndex: number
  /** IDs of the state(s) the simulation is currently in. Empty if uninitialized. */
  currentStateIds: string[]
  /** Current phase of the simulation. */
  status: SimulationStatus
  /** Stack of previous steps, enabling step-back navigation. */
  history: SimulationHistoryEntry[]
}

/** Versioned wrapper for JSON import/export of an automaton. */
export interface AutomatonExport {
  /** Schema version for forward compatibility. Currently always 1. */
  version: 1
  /** The serialized automaton data. */
  automaton: Automaton
}
