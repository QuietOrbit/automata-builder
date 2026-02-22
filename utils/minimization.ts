import type { AutomatonState, Transition } from "~/types/automaton";
import { AutomatonType } from "~/types/automaton";
import type { TupleData } from "~/stores/automaton";

/**
 * Result of DFA minimization, including the minimized 5-tuple
 * and human-readable merge descriptions.
 */
export interface MinimizationResult {
  /** The minimized DFA as a formal 5-tuple. */
  tuple: TupleData;
  /** Human-readable descriptions of merged equivalence classes. */
  merges: string[];
}

/**
 * Create a canonical key for a pair of state IDs (sorted) for use
 * as a set/map lookup key.
 *
 * @param a - First state ID.
 * @param b - Second state ID.
 * @returns Canonical "min,max" string key.
 */
function pairKey(a: string, b: string): string {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

/**
 * Find all state IDs reachable from the start state via BFS.
 *
 * @param states      - All states in the automaton.
 * @param transitions - All transitions.
 * @returns Set of IDs reachable from the start state.
 */
function findReachableIds(states: AutomatonState[], transitions: Transition[]): Set<string> {
  const start = states.find(s => s.isStart);
  if (!start) return new Set();

  const reachable = new Set<string>([start.id]);
  const queue = [start.id];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const t of transitions) {
      if (t.sourceId === current && !reachable.has(t.targetId)) {
        reachable.add(t.targetId);
        queue.push(t.targetId);
      }
    }
  }

  return reachable;
}

/**
 * Find all state IDs that can reach at least one accept state via reverse BFS.
 * The start state is always considered live to preserve the automaton structure.
 *
 * @param states      - All states in the automaton.
 * @param transitions - All transitions.
 * @returns Set of IDs that are live (can reach an accept state, or are the start state).
 */
function findLiveIds(states: AutomatonState[], transitions: Transition[]): Set<string> {
  const acceptIds = states.filter(s => s.isAccept).map(s => s.id);
  const live = new Set<string>(acceptIds);
  const queue = [...acceptIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const t of transitions) {
      if (t.targetId === current && !live.has(t.sourceId)) {
        live.add(t.sourceId);
        queue.push(t.sourceId);
      }
    }
  }

  // Start state is always kept
  const start = states.find(s => s.isStart);
  if (start) live.add(start.id);

  return live;
}

/**
 * Filter states to only those whose IDs are in the keep set.
 *
 * @param states    - All states.
 * @param keepIds   - Set of state IDs to keep.
 * @returns Filtered array of states.
 */
function filterStates(states: AutomatonState[], keepIds: Set<string>): AutomatonState[] {
  return states.filter(s => keepIds.has(s.id));
}

/**
 * Filter transitions to only those between kept states.
 *
 * @param transitions - All transitions.
 * @param keepIds     - Set of state IDs to keep.
 * @returns Filtered array of transitions.
 */
function filterTransitions(transitions: Transition[], keepIds: Set<string>): Transition[] {
  return transitions.filter(t => keepIds.has(t.sourceId) && keepIds.has(t.targetId));
}

/**
 * Build a transition lookup map for O(1) access: stateId -> symbol -> targetId.
 *
 * @param transitions - All transitions.
 * @returns Nested map for fast lookups.
 */
function buildTransitionMap(transitions: Transition[]): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>();
  for (const t of transitions) {
    if (!map.has(t.sourceId)) map.set(t.sourceId, new Map());
    map.get(t.sourceId)!.set(t.symbol, t.targetId);
  }
  return map;
}

/**
 * Collect the alphabet (unique symbols) from transitions, sorted.
 *
 * @param transitions - All transitions.
 * @returns Sorted array of symbols.
 */
function collectAlphabet(transitions: Transition[]): string[] {
  const symbols = new Set(transitions.map(t => t.symbol));
  return [...symbols].sort((a, b) => a.localeCompare(b));
}

// ── Distinguishability table ───────────────────────────────────────

/**
 * Mark all (accept, non-accept) pairs as immediately distinguished (base case).
 *
 * @param stateIds    - Array of state IDs.
 * @param acceptIdSet - Set of accept state IDs.
 * @returns Set of distinguished pair keys.
 */
function markBaseDistinguished(
  stateIds: string[],
  acceptIdSet: Set<string>,
): Set<string> {
  const distinguished = new Set<string>();
  for (let i = 0; i < stateIds.length; i++) {
    for (let j = i + 1; j < stateIds.length; j++) {
      if (acceptIdSet.has(stateIds[i]) !== acceptIdSet.has(stateIds[j])) {
        distinguished.add(pairKey(stateIds[i], stateIds[j]));
      }
    }
  }
  return distinguished;
}

/**
 * Check whether a pair of states becomes distinguished on any alphabet symbol.
 *
 * @param idA            - First state ID.
 * @param idB            - Second state ID.
 * @param alphabet       - Input alphabet.
 * @param transitionMap  - Precomputed transition lookup.
 * @param distinguished  - Currently distinguished pairs.
 * @returns True if the pair is distinguished by some symbol.
 */
function arePairDistinguished(
  idA: string,
  idB: string,
  alphabet: string[],
  transitionMap: Map<string, Map<string, string>>,
  distinguished: Set<string>,
): boolean {
  for (const symbol of alphabet) {
    const targetA = transitionMap.get(idA)?.get(symbol);
    const targetB = transitionMap.get(idB)?.get(symbol);

    if (targetA === undefined && targetB === undefined) continue;
    if (targetA === undefined || targetB === undefined) return true;
    if (targetA === targetB) continue;
    if (distinguished.has(pairKey(targetA, targetB))) return true;
  }
  return false;
}

/**
 * Run one pass of the table-filling iteration over all unmarked pairs.
 *
 * @param stateIds      - Array of state IDs.
 * @param distinguished - Mutable set of distinguished pair keys (updated in place).
 * @param transitionMap - Precomputed transition lookup.
 * @param alphabet      - Input alphabet.
 * @returns True if any new pair was marked during this pass.
 */
function refineDistinguished(
  stateIds: string[],
  distinguished: Set<string>,
  transitionMap: Map<string, Map<string, string>>,
  alphabet: string[],
): boolean {
  let changed = false;
  for (let i = 0; i < stateIds.length; i++) {
    for (let j = i + 1; j < stateIds.length; j++) {
      const key = pairKey(stateIds[i], stateIds[j]);
      if (distinguished.has(key)) continue;

      if (arePairDistinguished(stateIds[i], stateIds[j], alphabet, transitionMap, distinguished)) {
        distinguished.add(key);
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Build the distinguishability table using the Myhill-Nerode table-filling algorithm.
 *
 * @param stateIds      - Array of state IDs to consider.
 * @param acceptIdSet   - Set of accept state IDs.
 * @param transitionMap - Precomputed transition lookup.
 * @param alphabet      - Input alphabet.
 * @returns Set of distinguished pair keys.
 */
function buildDistinguishabilityTable(
  stateIds: string[],
  acceptIdSet: Set<string>,
  transitionMap: Map<string, Map<string, string>>,
  alphabet: string[],
): Set<string> {
  const distinguished = markBaseDistinguished(stateIds, acceptIdSet);

  while (refineDistinguished(stateIds, distinguished, transitionMap, alphabet)) {
    // iterate until fixed point
  }

  return distinguished;
}

// ── Union-Find ─────────────────────────────────────────────────────

/**
 * Find the root representative of a node in a union-find parent map,
 * applying path compression.
 *
 * @param x      - The node to find.
 * @param parent - Mutable parent map (updated for path compression).
 * @returns The root representative ID.
 */
function ufFind(x: string, parent: Map<string, string>): string {
  let root = x;
  while (parent.get(root) !== root) root = parent.get(root)!;

  let current = x;
  while (current !== root) {
    const next = parent.get(current)!;
    parent.set(current, root);
    current = next;
  }
  return root;
}

/**
 * Union two nodes in a union-find parent map.
 *
 * @param a      - First node.
 * @param b      - Second node.
 * @param parent - Mutable parent map.
 */
function ufUnion(a: string, b: string, parent: Map<string, string>): void {
  const ra = ufFind(a, parent);
  const rb = ufFind(b, parent);
  if (ra !== rb) parent.set(rb, ra);
}

/**
 * Build equivalence classes from the distinguishability table using union-find.
 * States that are not distinguished from each other are placed in the same class.
 *
 * @param stateIds      - Array of state IDs.
 * @param distinguished - Set of distinguished pair keys.
 * @returns Map from each state ID to the representative ID of its equivalence class.
 */
function buildEquivalenceClasses(
  stateIds: string[],
  distinguished: Set<string>,
): Map<string, string> {
  const parent = new Map<string, string>();
  for (const id of stateIds) parent.set(id, id);

  for (let i = 0; i < stateIds.length; i++) {
    for (let j = i + 1; j < stateIds.length; j++) {
      if (!distinguished.has(pairKey(stateIds[i], stateIds[j]))) {
        ufUnion(stateIds[i], stateIds[j], parent);
      }
    }
  }

  const result = new Map<string, string>();
  for (const id of stateIds) result.set(id, ufFind(id, parent));
  return result;
}

// ── Result construction ────────────────────────────────────────────

/** Bundled equivalence class data produced by the grouping phase. */
interface ClassData {
  /** Map from representative ID to its member IDs. */
  members: Map<string, string[]>;
  /** Map from representative ID to the chosen display name. */
  repNames: Map<string, string>;
  /** Map from every state ID to its representative ID. */
  representative: Map<string, string>;
}

/**
 * Group state IDs by their equivalence class representative.
 *
 * @param stateIds       - All state IDs.
 * @param representative - Map from state ID to representative ID.
 * @returns Map from representative ID to array of member IDs.
 */
function groupByRepresentative(
  stateIds: string[],
  representative: Map<string, string>,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const id of stateIds) {
    const rep = representative.get(id)!;
    if (!groups.has(rep)) groups.set(rep, []);
    groups.get(rep)!.push(id);
  }
  return groups;
}

/**
 * Pick the lexicographically smallest state name as the representative for each class.
 *
 * @param classMembers - Map from representative ID to array of member IDs.
 * @param idToName     - Map from state ID to display name.
 * @returns Map from representative ID to the chosen display name.
 */
function pickRepresentativeNames(
  classMembers: Map<string, string[]>,
  idToName: Map<string, string>,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const [repId, members] of classMembers) {
    const names = members.map(id => idToName.get(id)!).sort((a, b) => a.localeCompare(b));
    result.set(repId, names[0]);
  }
  return result;
}

/**
 * Build the transition map for the minimized DFA from equivalence class data.
 *
 * @param classes        - Bundled equivalence class data.
 * @param transitionMap  - Original transition lookup.
 * @param alphabet       - Input alphabet.
 * @returns Transition map in TupleData format.
 */
function buildMinimizedTransitions(
  classes: ClassData,
  transitionMap: Map<string, Map<string, string>>,
  alphabet: string[],
): Record<string, Record<string, string[]>> {
  const transitions: Record<string, Record<string, string[]>> = {};

  for (const [repId, memberIds] of classes.members) {
    const sourceId = memberIds[0];
    const symbolMap: Record<string, string[]> = {};

    for (const symbol of alphabet) {
      const targetId = transitionMap.get(sourceId)?.get(symbol);
      if (targetId !== undefined) {
        const targetRepId = classes.representative.get(targetId)!;
        symbolMap[symbol] = [classes.repNames.get(targetRepId)!];
      }
    }

    transitions[classes.repNames.get(repId)!] = symbolMap;
  }

  return transitions;
}

/**
 * Build the minimized DFA as a TupleData from equivalence class representatives.
 *
 * @param classes        - Bundled equivalence class data.
 * @param transitionMap  - Original transition lookup.
 * @param states         - Original (cleaned) states.
 * @param alphabet       - Input alphabet.
 * @returns TupleData for the minimized DFA.
 */
function buildResultTuple(
  classes: ClassData,
  transitionMap: Map<string, Map<string, string>>,
  states: AutomatonState[],
  alphabet: string[],
): TupleData {
  const repIds = [...classes.members.keys()];
  const startState = states.find(s => s.isStart)!;
  const startName = classes.repNames.get(classes.representative.get(startState.id)!)!;

  const acceptRepIds = new Set(
    states.filter(s => s.isAccept).map(s => classes.representative.get(s.id)!),
  );

  return {
    type: AutomatonType.DFA,
    states: repIds.map(id => classes.repNames.get(id)!),
    alphabet,
    startState: startName,
    acceptStates: repIds.filter(id => acceptRepIds.has(id)).map(id => classes.repNames.get(id)!),
    transitions: buildMinimizedTransitions(classes, transitionMap, alphabet),
  };
}

/**
 * Format a merge description for a single equivalence class with multiple members.
 *
 * @param repName    - The representative (surviving) state name.
 * @param otherNames - Sorted array of non-representative member names.
 * @returns Human-readable string like "q2 and q3 merged into q1".
 */
function formatMerge(repName: string, otherNames: string[]): string {
  const joined = otherNames.length === 1
    ? otherNames[0]
    : `${otherNames.slice(0, -1).join(", ")} and ${otherNames.at(-1)}`;
  return `${joined} merged into ${repName}`;
}

/**
 * Build human-readable merge descriptions for classes with more than one member.
 *
 * @param classes  - Bundled equivalence class data.
 * @param idToName - Map from state ID to display name.
 * @returns Array of strings like "q2 and q3 merged into q1".
 */
function buildMergeDescriptions(
  classes: ClassData,
  idToName: Map<string, string>,
): string[] {
  const descriptions: string[] = [];

  for (const [repId, memberIds] of classes.members) {
    if (memberIds.length <= 1) continue;

    const repName = classes.repNames.get(repId)!;
    const otherNames = memberIds
      .map(id => idToName.get(id)!)
      .filter(name => name !== repName)
      .sort((a, b) => a.localeCompare(b));

    descriptions.push(formatMerge(repName, otherNames));
  }

  return descriptions.sort((a, b) => a.localeCompare(b));
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Minimize a DFA using the table-filling (Myhill-Nerode) algorithm.
 *
 * Phases:
 * 0. Remove unreachable and dead states.
 * 1. Build O(1) transition lookup.
 * 2. Build distinguishability table (accept vs non-accept base case, then iterate).
 * 3. Compute equivalence classes via union-find over undistinguished pairs.
 * 4. Pick lexicographically smallest name per class as representative.
 * 5. Build minimized TupleData with remapped transitions.
 * 6. Generate human-readable merge descriptions.
 *
 * @param states      - All states in the DFA.
 * @param transitions - All transitions in the DFA.
 * @returns MinimizationResult with the minimized tuple and merge descriptions.
 * @throws Error if no start state is defined.
 */
export function minimizeDfa(
  states: AutomatonState[],
  transitions: Transition[],
): MinimizationResult {
  const start = states.find(s => s.isStart);
  if (!start) throw new Error("Cannot minimize: no start state defined.");

  // Phase 0: Remove unreachable and dead states
  const reachable = findReachableIds(states, transitions);
  const live = findLiveIds(states, transitions);
  const keepIds = new Set([...reachable].filter(id => live.has(id)));

  const cleanStates = filterStates(states, keepIds);
  const cleanTransitions = filterTransitions(transitions, keepIds);
  const idToName = new Map(cleanStates.map(s => [s.id, s.name]));

  // Phase 1: Build transition map
  const transitionMap = buildTransitionMap(cleanTransitions);
  const alphabet = collectAlphabet(cleanTransitions);

  // Phase 2: Build distinguishability table
  const stateIds = cleanStates.map(s => s.id);
  const acceptIdSet = new Set(cleanStates.filter(s => s.isAccept).map(s => s.id));
  const distinguished = buildDistinguishabilityTable(stateIds, acceptIdSet, transitionMap, alphabet);

  // Phase 3: Build equivalence classes
  const representative = buildEquivalenceClasses(stateIds, distinguished);

  // Phase 4: Group and pick representative names
  const members = groupByRepresentative(stateIds, representative);
  const repNames = pickRepresentativeNames(members, idToName);
  const classes: ClassData = { members, repNames, representative };

  // Phase 5: Build result tuple
  const tuple = buildResultTuple(classes, transitionMap, cleanStates, alphabet);

  // Phase 6: Build merge descriptions
  const merges = buildMergeDescriptions(classes, idToName);

  return { tuple, merges };
}
