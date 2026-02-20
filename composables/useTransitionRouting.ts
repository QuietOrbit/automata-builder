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

    // Normalize the pair so we can count all arrows between these two states
    const [idA, idB] = transition.sourceId < transition.targetId
      ? [transition.sourceId, transition.targetId]
      : [transition.targetId, transition.sourceId]

    // Count forward (A→B) and reverse (B→A) transitions
    const forwardTransitions = automaton.transitions.filter(
      t => t.sourceId === idA && t.targetId === idB,
    )
    const reverseTransitions = automaton.transitions.filter(
      t => t.sourceId === idB && t.targetId === idA,
    )

    const isForward = transition.sourceId === idA
    const myGroup = isForward ? forwardTransitions : reverseTransitions
    const otherGroup = isForward ? reverseTransitions : forwardTransitions
    const myIndex = myGroup.findIndex(t => t.id === transition.id)

    const totalArrows = forwardTransitions.length + reverseTransitions.length

    // Single arrow — straight line
    if (totalArrows === 1) {
      return computeStraightPath(source.position, target.position, STATE_RADIUS)
    }

    const baseOffset = 0.5

    // Same-direction only: fan out symmetrically around the straight line
    if (otherGroup.length === 0) {
      const n = myGroup.length
      const centered = (myIndex - (n - 1) / 2) * baseOffset
      if (centered === 0) {
        return computeStraightPath(source.position, target.position, STATE_RADIUS)
      }
      const dir = centered > 0 ? 1 : -1
      return computeCurvedPath(source.position, target.position, STATE_RADIUS, dir, Math.abs(centered))
    }

    // Bidirectional: all arrows use curveDirection=1.
    // The perpendicular naturally flips when source/target swap,
    // so forward and reverse arrows curve to opposite sides.
    const magnitude = (myIndex + 1) * baseOffset
    return computeCurvedPath(source.position, target.position, STATE_RADIUS, 1, magnitude)
  }

  return { getTransitionPath }
}
