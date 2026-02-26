import type { AutomatonState, Transition } from "~/types/automaton";
import { AutomatonType, EPSILON } from "~/types/automaton";
import type { TupleData } from "~/stores/automaton";
import { epsilonClosure } from "~/utils/epsilon";

/** Maximum number of DFA states before aborting subset construction. */
const MAX_DFA_STATES = 1024;

/**
 * Convert raw automaton store data to TupleData format.
 *
 * Builds a name-based transition map from ID-based transitions.
 * Epsilon transitions are included in the map (keyed by EPSILON)
 * but excluded from the alphabet, so that downstream functions
 * like {@link simplifyNfa} can handle ε-closure correctly.
 *
 * @param states      - All states in the automaton.
 * @param transitions - All transitions (may include ε-transitions).
 * @returns TupleData suitable for simplifyNfa or other processing.
 */
export function buildTupleData(
  states: AutomatonState[],
  transitions: Transition[],
): TupleData {
  const startState = states.find(s => s.isStart)!;
  const idToName = new Map(states.map(s => [s.id, s.name]));

  const transitionMap: Record<string, Record<string, string[]>> = {};
  for (const t of transitions) {
    const sourceName = idToName.get(t.sourceId)!;
    const targetName = idToName.get(t.targetId)!;
    if (!transitionMap[sourceName]) transitionMap[sourceName] = {};
    if (!transitionMap[sourceName][t.symbol]) transitionMap[sourceName][t.symbol] = [];
    if (!transitionMap[sourceName][t.symbol].includes(targetName)) {
      transitionMap[sourceName][t.symbol].push(targetName);
    }
  }

  // Sort target arrays for canonical ordering
  for (const symbolMap of Object.values(transitionMap)) {
    for (const [symbol, targets] of Object.entries(symbolMap)) {
      symbolMap[symbol] = targets.toSorted((a, b) => a.localeCompare(b));
    }
  }

  return {
    type: AutomatonType.NFA,
    states: states.map(s => s.name),
    alphabet: collectAlphabet(transitions),
    startState: startState.name,
    acceptStates: states.filter(s => s.isAccept).map(s => s.name),
    transitions: transitionMap,
  };
}

/**
 * Convert TupleData to minimal AutomatonState[] and Transition[] arrays.
 *
 * Creates lightweight state and transition objects suitable for passing
 * to functions like {@link subsetConstruction} or {@link minimizeDfa}
 * that operate on array-based formats. State names are used as IDs.
 *
 * @param tuple - TupleData to convert.
 * @returns Object with states and transitions arrays.
 */
export function tupleToArrays(tuple: TupleData): {
  states: AutomatonState[];
  transitions: Transition[];
} {
  const acceptSet = new Set(tuple.acceptStates);

  const states: AutomatonState[] = tuple.states.map(name => ({
    id: name,
    name,
    position: { x: 0, y: 0 },
    isStart: name === tuple.startState,
    isAccept: acceptSet.has(name),
  }));

  const transitions: Transition[] = [];
  for (const [source, symbolMap] of Object.entries(tuple.transitions)) {
    for (const [symbol, targets] of Object.entries(symbolMap)) {
      for (const target of targets) {
        transitions.push({
          id: `${source}-${symbol}-${target}`,
          sourceId: source,
          targetId: target,
          symbol,
        });
      }
    }
  }

  return { states, transitions };
}

/**
 * Rename all states in a TupleData to sequential q0, q1, q2, ...
 *
 * The start state is always assigned q0. Remaining states preserve
 * their original array order (typically BFS discovery order from
 * subset construction). Transitions and accept states are remapped.
 *
 * @param tuple - TupleData with arbitrary state names (e.g., set notation).
 * @returns New TupleData with sequential state names.
 */
export function renameStatesSequentially(tuple: TupleData): TupleData {
  const { states, startState, acceptStates, alphabet, transitions, type } = tuple;

  // Start state gets q0, rest follow in original order
  const ordered = [startState, ...states.filter(s => s !== startState)];
  const nameMap = new Map<string, string>();
  for (let i = 0; i < ordered.length; i++) {
    nameMap.set(ordered[i], `q${i}`);
  }

  const newTransitions: Record<string, Record<string, string[]>> = {};
  for (const oldName of ordered) {
    const symbolMap = transitions[oldName];
    if (!symbolMap) continue;
    const newName = nameMap.get(oldName)!;
    const newSymbolMap: Record<string, string[]> = {};
    for (const [symbol, targets] of Object.entries(symbolMap)) {
      newSymbolMap[symbol] = targets
        .map(t => nameMap.get(t)!)
        .sort((a, b) => a.localeCompare(b));
    }
    newTransitions[newName] = newSymbolMap;
  }

  return {
    type,
    states: ordered.map(s => nameMap.get(s)!),
    alphabet,
    startState: "q0",
    acceptStates: acceptStates
      .map(s => nameMap.get(s)!)
      .sort((a, b) => a.localeCompare(b)),
    transitions: newTransitions,
  };
}

/** Name used for the DFA trap/dead state. */
const TRAP_STATE = "∅";

/**
 * Ensure a DFA has a transition for every state × symbol pair.
 *
 * DFAs require total transition functions. If any transitions are missing
 * (typically after minimization removes unreachable dead states), this
 * adds a trap state `q∅` with self-loops and routes all missing
 * transitions there. Returns the tuple unchanged if already complete.
 *
 * @param tuple - A DFA TupleData that may have missing transitions.
 * @returns Complete DFA with a trap state added if needed.
 */
export function ensureCompleteDfa(tuple: TupleData): TupleData {
  const { states, alphabet, transitions } = tuple;

  const hasMissing = states.some(name =>
    alphabet.some(symbol => !transitions[name]?.[symbol]?.length),
  );

  if (!hasMissing) return tuple;

  // Build trap state with self-loops
  const trapTransitions: Record<string, string[]> = {};
  for (const symbol of alphabet) {
    trapTransitions[symbol] = [TRAP_STATE];
  }

  // Copy transitions, filling gaps with trap state
  const newTransitions: Record<string, Record<string, string[]>> = {};
  for (const name of states) {
    const symbolMap: Record<string, string[]> = {};
    for (const symbol of alphabet) {
      const existing = transitions[name]?.[symbol];
      symbolMap[symbol] = existing?.length ? existing : [TRAP_STATE];
    }
    newTransitions[name] = symbolMap;
  }
  newTransitions[TRAP_STATE] = trapTransitions;

  return {
    ...tuple,
    states: [...states, TRAP_STATE],
    transitions: newTransitions,
  };
}

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

/**
 * Convert a set of NFA state IDs to a canonical, sorted set-notation name.
 * Empty sets produce the dead state name "∅".
 *
 * @param ids      - NFA state IDs in this DFA state.
 * @param idToName - Map from state ID to state name.
 * @returns A canonical name like "{q0,q1}" or "∅".
 */
function toSetName(ids: string[], idToName: Map<string, string>): string {
  if (ids.length === 0) return "∅";
  const names = ids.map(id => idToName.get(id)!).sort((a, b) => a.localeCompare(b));
  return `{${names.join(",")}}`;
}

/**
 * Compute the set of NFA state IDs reachable from a DFA state set
 * on a given symbol, then apply epsilon closure.
 *
 * @param currentSet  - NFA state IDs in the current DFA state.
 * @param symbol      - The input symbol to follow.
 * @param transitions - All NFA transitions.
 * @returns Sorted array of NFA state IDs in the target DFA state.
 */
function computeDfaTarget(
  currentSet: string[],
  symbol: string,
  transitions: Transition[],
): string[] {
  const reached = new Set<string>();
  for (const stateId of currentSet) {
    for (const t of transitions) {
      if (t.sourceId === stateId && t.symbol === symbol) {
        reached.add(t.targetId);
      }
    }
  }

  return reached.size > 0
    ? epsilonClosure([...reached], transitions).sort((a, b) => a.localeCompare(b))
    : [];
}

/**
 * Build the DFA transition map for a single DFA state (a set of NFA states).
 * Returns the symbol map and tracks whether a dead state is needed.
 *
 * @param currentSet  - NFA state IDs in this DFA state.
 * @param alphabet    - Input alphabet symbols.
 * @param transitions - All NFA transitions.
 * @param idToName    - Map from NFA state ID to name.
 * @param visited     - Already-visited DFA states (by canonical name).
 * @param queue       - BFS queue for unvisited DFA state sets.
 * @returns The symbol map and whether any transition led to the dead state.
 */
function buildDfaSymbolMap(
  currentSet: string[],
  alphabet: string[],
  transitions: Transition[],
  idToName: Map<string, string>,
  visited: Map<string, string[]>,
  queue: string[][],
): { symbolMap: Record<string, string[]>; hasDeadTransition: boolean } {
  const symbolMap: Record<string, string[]> = {};
  let hasDeadTransition = false;

  for (const symbol of alphabet) {
    const targetSet = computeDfaTarget(currentSet, symbol, transitions);
    const targetName = toSetName(targetSet, idToName);

    if (targetSet.length === 0) {
      hasDeadTransition = true;
      symbolMap[symbol] = ["∅"];
    }
    else {
      symbolMap[symbol] = [targetName];
      if (!visited.has(targetName)) {
        visited.set(targetName, targetSet);
        queue.push(targetSet);
      }
    }
  }

  return { symbolMap, hasDeadTransition };
}

/**
 * Create a dead state entry with self-loops on every alphabet symbol.
 *
 * @param alphabet - Input alphabet symbols.
 * @returns Symbol map where every symbol maps to ["∅"].
 */
function buildDeadStateTransitions(alphabet: string[]): Record<string, string[]> {
  const symbolMap: Record<string, string[]> = {};
  for (const symbol of alphabet) {
    symbolMap[symbol] = ["∅"];
  }
  return symbolMap;
}

/**
 * Convert an NFA to an equivalent DFA using the subset construction algorithm.
 *
 * Each DFA state represents a set of NFA states. States are named using
 * sorted set notation (e.g., `{q0,q1}`). A dead state `∅` is created
 * for any missing transitions. Throws if the DFA exceeds MAX_DFA_STATES.
 *
 * @param states      - All NFA states.
 * @param transitions - All NFA transitions (epsilon transitions handled via closure).
 * @param alphabet    - The input alphabet (excluding epsilon).
 * @returns TupleData representing the equivalent DFA.
 * @throws Error if the number of DFA states exceeds the safety cap.
 */
export function subsetConstruction(
  states: AutomatonState[],
  transitions: Transition[],
  alphabet: string[],
): TupleData {
  const acceptIds = new Set(states.filter(s => s.isAccept).map(s => s.id));
  const idToName = new Map(states.map(s => [s.id, s.name]));

  // Start state is the epsilon closure of the NFA start state
  const startNfa = states.find(s => s.isStart)!;
  const startSet = epsilonClosure([startNfa.id], transitions).sort((a, b) => a.localeCompare(b));
  const startName = toSetName(startSet, idToName);

  // BFS through state sets
  const dfaTransitions: Record<string, Record<string, string[]>> = {};
  const dfaStates: string[] = [];
  const dfaAcceptStates: string[] = [];

  const visited = new Map<string, string[]>();
  const queue: string[][] = [startSet];
  visited.set(startName, startSet);

  let needsDeadState = false;

  while (queue.length > 0) {
    if (visited.size > MAX_DFA_STATES) {
      throw new Error(
        `Subset construction exceeded ${MAX_DFA_STATES} states. The NFA may be too complex to convert.`,
      );
    }

    const currentSet = queue.shift()!;
    const currentName = toSetName(currentSet, idToName);
    dfaStates.push(currentName);

    if (currentSet.some(id => acceptIds.has(id))) {
      dfaAcceptStates.push(currentName);
    }

    const { symbolMap, hasDeadTransition } = buildDfaSymbolMap(
      currentSet, alphabet, transitions, idToName, visited, queue,
    );

    if (hasDeadTransition) needsDeadState = true;
    dfaTransitions[currentName] = symbolMap;
  }

  if (needsDeadState) {
    dfaStates.push("∅");
    dfaTransitions["∅"] = buildDeadStateTransitions(alphabet);
  }

  return {
    type: AutomatonType.DFA,
    states: dfaStates,
    alphabet,
    startState: startName,
    acceptStates: dfaAcceptStates,
    transitions: dfaTransitions,
  };
}
