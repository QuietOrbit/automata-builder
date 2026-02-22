import type { Transition } from "~/types/automaton";
import { EPSILON } from "~/types/automaton";

/**
 * Compute the epsilon-closure of a set of state IDs.
 * Follows all ε-transitions reachable from the given states via BFS.
 *
 * @param stateIds    - Starting state IDs.
 * @param transitions - All transitions in the automaton.
 * @returns Array of all state IDs reachable via zero or more ε-transitions.
 */
export function epsilonClosure(stateIds: string[], transitions: Transition[]): string[] {
  const closure = new Set(stateIds);
  const queue = [...stateIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const t of transitions) {
      if (t.sourceId === current && t.symbol === EPSILON && !closure.has(t.targetId)) {
        closure.add(t.targetId);
        queue.push(t.targetId);
      }
    }
  }

  return [...closure];
}
