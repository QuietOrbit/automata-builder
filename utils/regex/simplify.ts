import { AutomatonType, EPSILON } from "~/types/automaton";
import type { TupleData } from "~/stores/automaton";

// ─── Epsilon Closure ────────────────────────────────────────────────

/**
 * Compute the epsilon closure of a single state using BFS over
 * the TupleData transition map.
 *
 * @param state       - The state name to start from.
 * @param transitions - TupleData transition map.
 * @returns Set of all state names reachable via zero or more ε-transitions.
 */
function epsilonClosureOf(
  state: string,
  transitions: Record<string, Record<string, string[]>>,
): Set<string> {
  const closure = new Set<string>([state]);
  const queue = [state];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const edges = transitions[current];
    if (!edges?.[EPSILON]) continue;
    for (const target of edges[EPSILON]) {
      if (!closure.has(target)) {
        closure.add(target);
        queue.push(target);
      }
    }
  }

  return closure;
}

/**
 * Canonical string key for a set of state names (sorted, comma-joined).
 *
 * @param states - Set of state names.
 * @returns Canonical key string.
 */
function closureKey(states: Set<string>): string {
  return [...states].sort((a, b) => a.localeCompare(b)).join(",");
}

// ─── Closure NFA Intermediate Representation ────────────────────────

/** Internal representation for the closure-based NFA between phases. */
interface ClosureNfa {
  stateKeys: string[];
  startKey: string;
  acceptKeys: Set<string>;
  alphabet: string[];
  /** stateKey → symbol → sorted target stateKey[] */
  transitions: Map<string, Map<string, string[]>>;
}

// ─── Phase 1: Build NFA from Epsilon Closure Sets ───────────────────

/**
 * Build a new NFA where each state represents an epsilon closure set
 * from the original Thompson NFA-ε.
 *
 * Instead of keeping all original states and adding transitions (which
 * creates an explosion for Thompson output), this discovers only the
 * distinct closure sets reachable via symbol transitions.
 *
 * @param tuple - Raw Thompson NFA-ε TupleData.
 * @returns Closure-based NFA with no epsilon transitions.
 */
function buildClosureNfa(tuple: TupleData): ClosureNfa {
  const { startState, acceptStates, alphabet, transitions } = tuple;
  const acceptSet = new Set(acceptStates);

  const startClosure = epsilonClosureOf(startState, transitions);
  const startKey = closureKey(startClosure);

  const discovered = new Map<string, Set<string>>();
  discovered.set(startKey, startClosure);

  const nfaTransitions = new Map<string, Map<string, string[]>>();
  const acceptKeys = new Set<string>();
  const queue = [startKey];

  while (queue.length > 0) {
    const key = queue.shift()!;
    const stateSet = discovered.get(key)!;

    if ([...stateSet].some(s => acceptSet.has(s))) {
      acceptKeys.add(key);
    }

    const symMap = buildClosureTransitions(
      stateSet, alphabet, transitions, discovered, queue,
    );
    nfaTransitions.set(key, symMap);
  }

  return {
    stateKeys: [...discovered.keys()],
    startKey,
    acceptKeys,
    alphabet,
    transitions: nfaTransitions,
  };
}

/**
 * Compute symbol transitions for a single closure state.
 *
 * For each alphabet symbol, follows all symbol transitions from the
 * original states in the closure set, then computes epsilon closures
 * of each target. Each unique closure becomes an NFA target state.
 *
 * @param stateSet     - Original states in this closure state.
 * @param alphabet     - Input alphabet symbols.
 * @param transitions  - Original Thompson transitions.
 * @param discovered   - Already-discovered closure states (mutated).
 * @param queue        - BFS queue for undiscovered states (mutated).
 * @returns Symbol map for this closure state.
 */
function buildClosureTransitions(
  stateSet: Set<string>,
  alphabet: string[],
  transitions: Record<string, Record<string, string[]>>,
  discovered: Map<string, Set<string>>,
  queue: string[],
): Map<string, string[]> {
  const symMap = new Map<string, string[]>();

  for (const symbol of alphabet) {
    const targetKeys = new Set<string>();

    for (const s of stateSet) {
      const edges = transitions[s];
      if (!edges?.[symbol]) continue;
      for (const target of edges[symbol]) {
        const targetClosure = epsilonClosureOf(target, transitions);
        const targetKey = closureKey(targetClosure);
        targetKeys.add(targetKey);

        if (!discovered.has(targetKey)) {
          discovered.set(targetKey, targetClosure);
          queue.push(targetKey);
        }
      }
    }

    if (targetKeys.size > 0) {
      symMap.set(symbol, [...targetKeys].sort((a, b) => a.localeCompare(b)));
    }
  }

  return symMap;
}

// ─── Phase 2: Signature-Based State Merging ─────────────────────────

/**
 * Compute a canonical signature string for a state's behavior.
 *
 * Two states with identical signatures have the same accept status
 * and identical transition targets for every symbol.
 *
 * @param key        - The state's key.
 * @param isAccept   - Whether this state is accepting.
 * @param transitions - All NFA transitions.
 * @param alphabet   - Input alphabet.
 * @returns Canonical signature string.
 */
function computeSignature(
  key: string,
  isAccept: boolean,
  transitions: Map<string, Map<string, string[]>>,
  alphabet: string[],
): string {
  const parts = [isAccept ? "T" : "F"];
  const symMap = transitions.get(key);
  for (const symbol of alphabet) {
    const targets = symMap?.get(symbol);
    if (targets && targets.length > 0) {
      parts.push(`${symbol}:${targets.join(",")}`);
    }
  }
  return parts.join("|");
}

/**
 * Iteratively merge states with identical behavior signatures.
 *
 * Each round groups states by (accept status, transition targets),
 * replaces each group with one representative, and updates transitions.
 * Repeats until no more merges are possible (fixpoint).
 *
 * @param nfa - Closure-based NFA from Phase 1.
 * @returns NFA with equivalent states merged.
 */
function mergeEquivalentStates(nfa: ClosureNfa): ClosureNfa {
  let { stateKeys, startKey, acceptKeys, transitions } = nfa;
  const { alphabet } = nfa;

  for (;;) {
    const groups = groupBySignature(stateKeys, acceptKeys, transitions, alphabet);
    const mergeMap = buildMergeMap(groups, startKey);

    if (!mergeMap) break;

    const result = applyMerge(mergeMap, startKey, acceptKeys, transitions);
    stateKeys = result.stateKeys;
    startKey = result.startKey;
    acceptKeys = result.acceptKeys;
    transitions = result.transitions;
  }

  return { stateKeys, startKey, acceptKeys, alphabet, transitions };
}

/**
 * Group states by their behavior signature.
 *
 * @returns Map from signature string to list of state keys in that group.
 */
function groupBySignature(
  stateKeys: string[],
  acceptKeys: Set<string>,
  transitions: Map<string, Map<string, string[]>>,
  alphabet: string[],
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const key of stateKeys) {
    const sig = computeSignature(key, acceptKeys.has(key), transitions, alphabet);
    const group = groups.get(sig);
    if (group) group.push(key);
    else groups.set(sig, [key]);
  }
  return groups;
}

/**
 * Build a merge map from groups. Returns null if no merging is possible.
 *
 * For each group with multiple states, picks one representative
 * (preferring the start state). Maps all group members to the representative.
 *
 * @param groups   - State groups by signature.
 * @param startKey - The start state key (preferred representative).
 * @returns Merge map, or null if no groups have multiple members.
 */
function buildMergeMap(
  groups: Map<string, string[]>,
  startKey: string,
): Map<string, string> | null {
  let hasMulti = false;
  const mergeMap = new Map<string, string>();

  for (const group of groups.values()) {
    if (group.length > 1) hasMulti = true;
    const rep = group.includes(startKey) ? startKey : group[0];
    for (const key of group) {
      mergeMap.set(key, rep);
    }
  }

  return hasMulti ? mergeMap : null;
}

/**
 * Apply a merge map: remap all transitions to use representative states.
 *
 * @param mergeMap   - Old state key → representative key.
 * @param startKey   - Current start state key.
 * @param acceptKeys - Current accept state keys.
 * @param transitions - Current transitions.
 * @returns Updated NFA components after merging.
 */
function applyMerge(
  mergeMap: Map<string, string>,
  startKey: string,
  acceptKeys: Set<string>,
  transitions: Map<string, Map<string, string[]>>,
): { stateKeys: string[]; startKey: string; acceptKeys: Set<string>; transitions: Map<string, Map<string, string[]>> } {
  const newKeys = new Set<string>(mergeMap.values());
  const newTransitions = new Map<string, Map<string, string[]>>();

  for (const key of newKeys) {
    const symMap = transitions.get(key);
    if (!symMap) continue;
    const newSymMap = new Map<string, string[]>();
    for (const [symbol, targets] of symMap) {
      const remapped = [...new Set(targets.map(t => mergeMap.get(t) ?? t))].sort((a, b) => a.localeCompare(b));
      newSymMap.set(symbol, remapped);
    }
    newTransitions.set(key, newSymMap);
  }

  return {
    stateKeys: [...newKeys],
    startKey: mergeMap.get(startKey) ?? startKey,
    acceptKeys: new Set([...acceptKeys].map(k => mergeMap.get(k) ?? k)),
    transitions: newTransitions,
  };
}

// ─── Phase 3: Dead State Removal ────────────────────────────────────

/**
 * Remove states that cannot reach any accept state.
 *
 * Uses reverse BFS from accept states to find productive states.
 * The start state is always kept (to represent the empty language).
 *
 * @param nfa - NFA after merging.
 * @returns NFA with dead states removed.
 */
function removeDeadStates(nfa: ClosureNfa): ClosureNfa {
  const { stateKeys, startKey, acceptKeys, alphabet, transitions } = nfa;

  const reverseAdj = buildReverseAdj(stateKeys, transitions);
  const productive = findProductiveStates(acceptKeys, reverseAdj);
  productive.add(startKey);

  const newKeys = stateKeys.filter(k => productive.has(k));
  const newAcceptKeys = new Set([...acceptKeys].filter(k => productive.has(k)));

  const newTransitions = new Map<string, Map<string, string[]>>();
  for (const key of newKeys) {
    const symMap = transitions.get(key);
    if (!symMap) continue;
    const newSymMap = new Map<string, string[]>();
    for (const [symbol, targets] of symMap) {
      const filtered = targets.filter(t => productive.has(t));
      if (filtered.length > 0) {
        newSymMap.set(symbol, filtered);
      }
    }
    if (newSymMap.size > 0) {
      newTransitions.set(key, newSymMap);
    }
  }

  return { stateKeys: newKeys, startKey, acceptKeys: newAcceptKeys, alphabet, transitions: newTransitions };
}

/**
 * Build reverse adjacency map: target → set of source states.
 */
function buildReverseAdj(
  stateKeys: string[],
  transitions: Map<string, Map<string, string[]>>,
): Map<string, Set<string>> {
  const reverseAdj = new Map<string, Set<string>>();
  for (const key of stateKeys) {
    reverseAdj.set(key, new Set());
  }
  for (const key of stateKeys) {
    const symMap = transitions.get(key);
    if (!symMap) continue;
    for (const targets of symMap.values()) {
      for (const target of targets) {
        reverseAdj.get(target)?.add(key);
      }
    }
  }
  return reverseAdj;
}

/**
 * BFS backward from accept states to find all productive states.
 */
function findProductiveStates(
  acceptKeys: Set<string>,
  reverseAdj: Map<string, Set<string>>,
): Set<string> {
  const productive = new Set<string>(acceptKeys);
  const queue = [...acceptKeys];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const pred of reverseAdj.get(current) ?? []) {
      if (!productive.has(pred)) {
        productive.add(pred);
        queue.push(pred);
      }
    }
  }

  return productive;
}

// ─── Phase 4: Convert to TupleData ─────────────────────────────────

/**
 * Convert the internal closure NFA to TupleData with sequential state names.
 *
 * Start state is always q0. Remaining states are numbered q1, q2, ...
 *
 * @param nfa - Final simplified closure NFA.
 * @returns TupleData ready for buildFromTuple().
 */
function toTupleData(nfa: ClosureNfa): TupleData {
  const { stateKeys, startKey, acceptKeys, alphabet, transitions } = nfa;

  // Start state gets q0, rest follow in discovery order
  const ordered = [startKey, ...stateKeys.filter(k => k !== startKey)];
  const nameMap = new Map<string, string>();
  for (let i = 0; i < ordered.length; i++) {
    nameMap.set(ordered[i], `q${i}`);
  }

  const tupleTransitions: Record<string, Record<string, string[]>> = {};
  for (const key of ordered) {
    const symMap = transitions.get(key);
    if (!symMap || symMap.size === 0) continue;
    const name = nameMap.get(key)!;
    const symbolMap: Record<string, string[]> = {};
    for (const [symbol, targets] of symMap) {
      symbolMap[symbol] = targets.map(t => nameMap.get(t)!).sort((a, b) => a.localeCompare(b));
    }
    tupleTransitions[name] = symbolMap;
  }

  return {
    type: AutomatonType.NFA,
    states: ordered.map(k => nameMap.get(k)!),
    alphabet,
    startState: nameMap.get(startKey)!,
    acceptStates: [...acceptKeys].map(k => nameMap.get(k)!).sort((a, b) => a.localeCompare(b)),
    transitions: tupleTransitions,
  };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Simplify an NFA-ε produced by Thompson's construction into a clean NFA.
 *
 * Applies four phases:
 * 1. **Closure-based construction** — builds a new NFA where each state is an
 *    epsilon closure set, eliminating all ε-transitions and redundant states
 * 2. **Signature-based merging** — iteratively merges states with identical
 *    behavior (same accept status and transition targets) until stable
 * 3. **Dead state removal** — removes states that cannot reach any accept state
 * 4. **Renumbering** — names states sequentially as q0, q1, q2, ...
 *
 * @param tuple - TupleData from Thompson's construction (may contain ε-transitions).
 * @returns Simplified TupleData with no ε-transitions and minimal states.
 */
export function simplifyNfa(tuple: TupleData): TupleData {
  const closureNfa = buildClosureNfa(tuple);
  const merged = mergeEquivalentStates(closureNfa);
  const cleaned = removeDeadStates(merged);
  return toTupleData(cleaned);
}
