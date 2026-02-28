import type { Transition, TransitionRoute } from "~/types/automaton";
import { useAutomatonStore } from "~/stores/automaton";
import {
  connectionRadius,
  computeSelfLoopPath,
  computeStraightPath,
  computeCurvedPath,
  type TransitionPath,
} from "~/utils/canvas/geometry";
import { computeRouting, SECTOR_ANGLES } from "~/utils/canvas/routing";

/**
 * Composable that computes SVG arrow geometry for transitions.
 *
 * A computed route map is derived from automaton topology (states and
 * transitions). The map is recalculated reactively whenever positions
 * or transitions change, without mutating store state.
 * `getTransitionPath` uses the route map to select the appropriate
 * path strategy: self-loops get a sector-placed arc, unidirectional
 * edges get a straight line, and bidirectional edges get a curved path.
 */
export function useTransitionRouting() {
  const automaton = useAutomatonStore();

  // Derive route data reactively. Returns a Map<transitionId, TransitionRoute>.
  // Because this is a computed (not a watchEffect), it never mutates store
  // state and cannot trigger an infinite reactive loop.
  const routeMap = computed<Map<string, TransitionRoute>>(() => {
    return computeRouting(automaton.states, automaton.transitions);
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
    const route = routeMap.value.get(transition.id);

    // Self-loop — use routed sector slot or fall back to top
    if (transition.sourceId === transition.targetId) {
      const slot = route?.selfLoopSlot ?? 0;
      const sectorAngle = SECTOR_ANGLES.at(slot) ?? SECTOR_ANGLES.at(0) ?? (-Math.PI / 2);
      return computeSelfLoopPath(source.position, sourceR, sectorAngle);
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
