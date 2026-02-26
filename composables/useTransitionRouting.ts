import type { Transition } from "~/types/automaton";
import { useAutomatonStore } from "~/stores/automaton";
import {
  connectionRadius,
  computeSelfLoopPath,
  computeStraightPath,
  computeCurvedPath,
  type TransitionPath,
} from "~/utils/geometry";
import { computeRouting, SECTOR_ANGLES } from "~/utils/routing";

/**
 * Composable that computes SVG arrow geometry for transitions.
 *
 * On each reactive change to automaton states or transitions, the global
 * routing algorithm runs first (assigning sector slots and connection
 * angles). Then `getTransitionPath` uses the resolved route data to
 * select the appropriate path strategy: self-loops get a sector-placed
 * arc, unidirectional edges get a straight line, and bidirectional
 * edges get a curved path to avoid overlap.
 */
export function useTransitionRouting() {
  const automaton = useAutomatonStore();

  // Run the global routing algorithm whenever automaton topology changes.
  // This writes `route` data onto each transition in place.
  watchEffect(() => {
    computeRouting(automaton.states, automaton.transitions);
  });

  /**
   * Compute the SVG path data and label position for a transition arrow.
   * Returns null if either the source or target state cannot be found.
   * @param transition - The transition to compute a path for.
   */
  function getTransitionPath(transition: Transition): TransitionPath | null {
    const source = automaton.getState(transition.sourceId);
    const target = automaton.getState(transition.targetId);
    if (!source || !target) return null;

    const sourceR = connectionRadius(source.isAccept);
    const targetR = connectionRadius(target.isAccept);

    // Self-loop — use routed sector slot or fall back to top
    if (transition.sourceId === transition.targetId) {
      const slot = transition.route?.selfLoopSlot ?? 0;
      return computeSelfLoopPath(source.position, sourceR, SECTOR_ANGLES[slot]);
    }

    // Check if a reverse direction exists
    const hasReverse = automaton.transitions.some(
      t => t.sourceId === transition.targetId && t.targetId === transition.sourceId,
    );

    if (!hasReverse) {
      return computeStraightPath(source.position, target.position, sourceR, targetR);
    }

    // Bidirectional: curve with direction=1.
    // The perpendicular naturally flips when source/target swap,
    // so opposite directions curve to opposite sides.
    return computeCurvedPath(source.position, target.position, sourceR, 1, 0.5, targetR);
  }

  return { getTransitionPath };
}
