import type { Transition } from '~/types/automaton'
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

    // Check if a reverse direction exists
    const hasReverse = automaton.transitions.some(
      t => t.sourceId === transition.targetId && t.targetId === transition.sourceId,
    )

    if (!hasReverse) {
      return computeStraightPath(source.position, target.position, STATE_RADIUS)
    }

    // Bidirectional: curve with direction=1.
    // The perpendicular naturally flips when source/target swap,
    // so opposite directions curve to opposite sides.
    return computeCurvedPath(source.position, target.position, STATE_RADIUS, 1, 0.5)
  }

  return { getTransitionPath }
}
