import { useSimulationStore } from '~/stores/simulation'

/**
 * Thin wrapper composable that exposes simulation store actions for use in components.
 * Provides a convenience API without requiring components to import the store directly.
 */
export function useSimulation() {
  const sim = useSimulationStore()

  /** Set the input string and reset the simulation. */
  function setInput(input: string) {
    sim.setInput(input)
  }

  /** Advance the simulation by one input symbol. */
  function step() {
    sim.step()
  }

  /** Undo the most recent simulation step. */
  function stepBack() {
    sim.stepBack()
  }

  /** Run the simulation to completion (or until the safety limit). */
  function runToEnd() {
    sim.runToEnd()
  }

  /** Reset the simulation back to the start state. */
  function reset() {
    sim.reset()
  }

  return {
    sim,
    setInput,
    step,
    stepBack,
    runToEnd,
    reset,
  }
}
