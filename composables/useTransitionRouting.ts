import type { AutomatonState, Transition } from '~/types/automaton'
import { useAutomatonStore } from '~/stores/automaton'
import {
  STATE_RADIUS,
  computeSelfLoopPath,
  computeStraightPath,
  computeCurvedPath,
  type TransitionPath,
} from '~/utils/geometry'

export function useTransitionRouting() {
  const automaton = useAutomatonStore()

  function getTransitionPath(transition: Transition): TransitionPath | null {
    const source = automaton.getState(transition.sourceId)
    const target = automaton.getState(transition.targetId)
    if (!source || !target) return null

    // Self-loop
    if (transition.sourceId === transition.targetId) {
      return computeSelfLoopPath(source.position, STATE_RADIUS)
    }

    // Check if bidirectional (reverse edge exists)
    const isBidirectional = automaton.hasBidirectional(transition.sourceId, transition.targetId)

    if (isBidirectional) {
      // Determine curve direction: the transition with the "smaller" source ID curves left (1),
      // the other curves right (-1). This ensures consistency.
      const curveDir = transition.sourceId < transition.targetId ? 1 : -1
      return computeCurvedPath(source.position, target.position, STATE_RADIUS, curveDir as 1 | -1)
    }

    // Straight line
    return computeStraightPath(source.position, target.position, STATE_RADIUS)
  }

  return { getTransitionPath }
}
