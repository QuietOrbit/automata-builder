import { useSimulationStore } from '~/stores/simulation'

export function useSimulation() {
  const sim = useSimulationStore()

  function setInput(input: string) {
    sim.setInput(input)
  }

  function step() {
    sim.step()
  }

  function stepBack() {
    sim.stepBack()
  }

  function runToEnd() {
    sim.runToEnd()
  }

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
