import type { AutomatonState, Transition } from "~/types/automaton";
import { AutomatonType, EPSILON } from "~/types/automaton";
import type { TupleData } from "~/stores/automaton";
import { epsilonClosure } from "~/utils/epsilon";

/**
 * Compute the non-epsilon alphabet from a set of transitions, sorted.
 *
 * @param transitions - All transitions in the automaton.
 * @returns Sorted array of unique non-epsilon symbols.
 */
function collectAlphabet(transitions: Transition[]): string[] {
  const symbols = new Set(
    transitions.filter(t => t.symbol !== EPSILON).map(t => t.symbol),
  );
  return [...symbols].sort((a, b) => a.localeCompare(b));
}

/**
 * Compute epsilon closures for every state in the automaton.
 *
 * @param states      - All states.
 * @param transitions - All transitions (may include ε-transitions).
 * @returns Map from state ID to the array of IDs in its epsilon closure.
 */
function computeAllClosures(
  states: AutomatonState[],
  transitions: Transition[],
): Map<string, string[]> {
  const closures = new Map<string, string[]>();
  for (const s of states) {
    closures.set(s.id, epsilonClosure([s.id], transitions));
  }
  return closures;
}

/**
 * Find all state names reachable from a set of closure state IDs on a given symbol,
 * including epsilon closure of the targets.
 *
 * @param closureStateIds - State IDs in the source state's epsilon closure.
 * @param symbol          - The input symbol to follow.
 * @param transitions     - All transitions.
 * @param closures        - Precomputed epsilon closures for all states.
 * @param idToName        - Map from state ID to state name.
 * @returns Sorted array of reachable target state names.
 */
function findReachableTargets(
  closureStateIds: string[],
  symbol: string,
  transitions: Transition[],
  closures: Map<string, string[]>,
  idToName: Map<string, string>,
): string[] {
  const targets = new Set<string>();

  for (const stateId of closureStateIds) {
    for (const t of transitions) {
      if (t.sourceId === stateId && t.symbol === symbol) {
        const targetClosure = closures.get(t.targetId) ?? [t.targetId];
        for (const reachable of targetClosure) {
          targets.add(idToName.get(reachable)!);
        }
      }
    }
  }

  return targets.size > 0
    ? [...targets].sort((a, b) => a.localeCompare(b))
    : [];
}

/**
 * Build the transition map for a single state after epsilon removal.
 *
 * @param closure     - The epsilon closure of the source state.
 * @param alphabet    - Non-epsilon input symbols.
 * @param transitions - All original transitions.
 * @param closures    - Precomputed epsilon closures for all states.
 * @param idToName    - Map from state ID to state name.
 * @returns Symbol map: `symbol → sorted target names[]`.
 */
function buildSymbolMap(
  closure: string[],
  alphabet: string[],
  transitions: Transition[],
  closures: Map<string, string[]>,
  idToName: Map<string, string>,
): Record<string, string[]> {
  const symbolMap: Record<string, string[]> = {};

  for (const symbol of alphabet) {
    const targets = findReachableTargets(closure, symbol, transitions, closures, idToName);
    if (targets.length > 0) {
      symbolMap[symbol] = targets;
    }
  }

  return symbolMap;
}

/**
 * Remove epsilon transitions from an NFA-ε, producing an equivalent NFA.
 *
 * For each state, computes its epsilon closure and rebuilds transitions
 * so that every path previously requiring epsilon steps is captured by
 * direct symbol transitions. Accept status propagates through closures.
 *
 * @param states      - All states in the automaton.
 * @param transitions - All transitions (may include ε-transitions).
 * @returns TupleData representing the equivalent epsilon-free NFA.
 */
export function removeEpsilonTransitions(
  states: AutomatonState[],
  transitions: Transition[],
): TupleData {
  const startState = states.find(s => s.isStart)!;
  const acceptSet = new Set(states.filter(s => s.isAccept).map(s => s.id));
  const idToName = new Map(states.map(s => [s.id, s.name]));
  const closures = computeAllClosures(states, transitions);
  const alphabet = collectAlphabet(transitions);

  // Build new transitions: for each state, close → step → close
  const newTransitions: Record<string, Record<string, string[]>> = {};
  for (const s of states) {
    newTransitions[s.name] = buildSymbolMap(
      closures.get(s.id)!, alphabet, transitions, closures, idToName,
    );
  }

  // A state is accepting if its ε-closure contains any original accept state
  const newAcceptStates = states
    .filter(s => closures.get(s.id)!.some(id => acceptSet.has(id)))
    .map(s => s.name);

  return {
    type: AutomatonType.NFA,
    states: states.map(s => s.name),
    alphabet,
    startState: startState.name,
    acceptStates: newAcceptStates,
    transitions: newTransitions,
  };
}
