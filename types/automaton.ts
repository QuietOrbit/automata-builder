export type StateId = string
export type TransitionId = string

export interface Position {
  x: number
  y: number
}

export interface AutomatonState {
  id: StateId
  name: string
  position: Position
  isStart: boolean
  isAccept: boolean
}

export interface Transition {
  id: TransitionId
  sourceId: StateId
  targetId: StateId
  symbol: string
}

export type AutomatonType = 'DFA' | 'NFA'

export interface Automaton {
  id: string
  name: string
  type: AutomatonType
  alphabet: string[]
  states: AutomatonState[]
  transitions: Transition[]
}

export type SimulationStatus = 'idle' | 'running' | 'accepted' | 'rejected' | 'stuck'

export interface SimulationHistoryEntry {
  stateId: StateId
  symbolRead: string | null
  transitionId: TransitionId | null
}

export interface SimulationState {
  input: string
  currentIndex: number
  currentStateId: StateId | null
  status: SimulationStatus
  history: SimulationHistoryEntry[]
}

export interface AutomatonExport {
  version: 1
  automaton: Automaton
}
