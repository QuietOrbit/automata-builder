export interface Position {
  x: number
  y: number
}

export interface AutomatonState {
  id: string
  name: string
  position: Position
  isStart: boolean
  isAccept: boolean
}

export interface Transition {
  id: string
  sourceId: string
  targetId: string
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
  stateId: string
  symbolRead: string | null
  transitionId: string | null
}

export interface SimulationState {
  input: string
  currentIndex: number
  currentStateId: string | null
  status: SimulationStatus
  history: SimulationHistoryEntry[]
}

export interface AutomatonExport {
  version: 1
  automaton: Automaton
}
