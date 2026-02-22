/**
 * Hybrid auto-layout for automata built from 5-tuples.
 *
 * All state references use numeric indices into the caller's state array.
 *
 * Analyses the graph structure via BFS from the start state, classifies the
 * shape as **chain**, **layered**, or **dense**, and returns positions tuned
 * to that shape. For layered layouts, applies barycenter crossing minimization
 * to reduce visual clutter. Unreachable states are placed in a row beneath
 * the main layout.
 *
 * @module layout
 */

import type { Position } from "~/types/automaton";

/** Directed edge described by indices into the state array. */
export interface LayoutTransition {
  sourceIndex: number;
  targetIndex: number;
}

/** Optional spacing overrides for the layout algorithm. */
export interface LayoutSpacing {
  /** Horizontal distance between columns/states. Default: 150. */
  hSpacing?: number;
  /** Vertical distance between states in the same column. Default: 120. */
  vSpacing?: number;
}

/** The three recognised graph shapes. */
type LayoutKind = "chain" | "layered" | "dense";

// ─── BFS & Classification ───────────────────────────────────────────

/**
 * Run a breadth-first search from {@link start} over the directed graph
 * described by {@link adjacency} and return the BFS depth of every reachable
 * node.
 *
 * @param start      - Index of the start state.
 * @param adjacency  - Directed adjacency list (state index → set of neighbour indices).
 * @returns An array mapping state index to BFS depth, or `-1` if unreachable.
 *
 * @example
 * ```ts
 * const adj = [new Set([1]), new Set([2]), new Set()];
 * bfs(0, adj); // [0, 1, 2]
 * ```
 */
function bfs(
  start: number,
  adjacency: Set<number>[],
): Int32Array {
  const depths = new Int32Array(adjacency.length).fill(-1);
  depths[start] = 0;
  const queue: number[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const depth = depths[current];
    for (const neighbour of adjacency[current]) {
      if (depths[neighbour] === -1) {
        depths[neighbour] = depth + 1;
        queue.push(neighbour);
      }
    }
  }

  return depths;
}

/**
 * Group reachable state indices by their BFS depth, preserving BFS visit
 * order within each group.
 *
 * @param depths - Array mapping state index to BFS depth (`-1` = unreachable).
 * @returns An array of arrays, where index `i` holds the state indices at depth `i`.
 *
 * @example
 * ```ts
 * groupByLayer(Int32Array.from([0, 1, 1, 2]));
 * // [[0], [1, 2], [3]]
 * ```
 */
function groupByLayer(depths: Int32Array): number[][] {
  const groups: number[][] = [];
  for (let i = 0; i < depths.length; i++) {
    const depth = depths[i];
    if (depth === -1) continue;
    while (groups.length <= depth) groups.push([]);
    groups[depth].push(i);
  }
  return groups;
}

/**
 * Compute the ratio of non-forward edges (back-edges, same-layer edges,
 * skip-edges) to total non-self-loop edges among reachable states.
 *
 * A forward edge goes from depth `d` to depth `d + 1`. Anything else
 * (same layer, backward, or skipping layers) is non-forward and creates
 * visual clutter in a layered layout.
 *
 * @param transitions - Directed edges by index.
 * @param depths      - BFS depth array (`-1` = unreachable).
 * @returns Ratio in `[0, 1]`. Returns `0` when there are no qualifying edges.
 */
function computeBackEdgeRatio(
  transitions: LayoutTransition[],
  depths: Int32Array,
): number {
  let nonForward = 0;
  let total = 0;
  for (const { sourceIndex, targetIndex } of transitions) {
    if (sourceIndex === targetIndex) continue;
    if (depths[sourceIndex] === -1 || depths[targetIndex] === -1) continue;
    total++;
    if (depths[targetIndex] - depths[sourceIndex] !== 1) nonForward++;
  }
  return total > 0 ? nonForward / total : 0;
}

/**
 * Classify the graph shape based on BFS layer structure and edge direction.
 *
 * - **chain** — every BFS layer has exactly 1 state and all edges are
 *   forward (depth +1). No back-edges or layer-skipping edges.
 * - **layered** — multiple BFS layers with moderate width (≤3 states per
 *   layer) and a low proportion of non-forward edges (< 35%).
 * - **dense** — any of: single BFS layer with > 2 states; chain with
 *   back-edges; layers with ≥ 4 states; or ≥ 35% non-forward edges
 *   (indicating heavy cyclicity where a circular layout is cleaner).
 *
 * @param layerGroups    - Reachable states grouped by BFS depth.
 * @param totalStates    - Total number of states (reachable + unreachable).
 * @param backEdgeRatio  - Ratio of non-forward edges to total non-self-loop
 *                         edges (from {@link computeBackEdgeRatio}).
 * @returns The detected layout kind.
 */
function classify(
  layerGroups: number[][],
  totalStates: number,
  backEdgeRatio: number,
): LayoutKind {
  if (layerGroups.length <= 1 && totalStates > 2) return "dense";

  const maxWidth = Math.max(...layerGroups.map(g => g.length));
  if (maxWidth === 1 && backEdgeRatio === 0) return "chain";
  if (maxWidth === 1) return "dense";
  if (backEdgeRatio >= 0.35 || maxWidth >= 4) return "dense";
  return "layered";
}

// ─── Crossing Minimization ──────────────────────────────────────────

/**
 * Build a reverse adjacency list (predecessor map) from a forward adjacency.
 *
 * @param adjacency - Forward adjacency list.
 * @returns Reverse adjacency where `result[i]` contains all predecessors of state `i`.
 */
function buildReverseAdjacency(adjacency: Set<number>[]): Set<number>[] {
  const reverse: Set<number>[] = Array.from({ length: adjacency.length }, () => new Set());
  for (let i = 0; i < adjacency.length; i++) {
    for (const j of adjacency[i]) {
      reverse[j].add(i);
    }
  }
  return reverse;
}

/**
 * Compute the barycenter (average position) of a node's neighbours in an
 * adjacent layer. Returns `Infinity` for nodes with no connections to the
 * reference layer, so they sort to the end.
 *
 * @param node       - The node to compute the barycenter for.
 * @param neighbours - Adjacency set (predecessors or successors).
 * @param layerIndex - Map from node index to its position within its layer.
 * @returns The average position of connected nodes in the reference layer.
 */
function barycenter(
  node: number,
  neighbours: Set<number>,
  layerIndex: Map<number, number>,
): number {
  let sum = 0;
  let count = 0;
  for (const n of neighbours) {
    const pos = layerIndex.get(n);
    if (pos !== undefined) {
      sum += pos;
      count++;
    }
  }
  return count > 0 ? sum / count : Infinity;
}

/**
 * Build a lookup map from node index to its position within its layer.
 *
 * @param layer - Array of node indices in a single layer.
 * @returns Map from node index to position (0-based).
 */
function buildLayerIndex(layer: number[]): Map<number, number> {
  const index = new Map<number, number>();
  for (let i = 0; i < layer.length; i++) {
    index.set(layer[i], i);
  }
  return index;
}

/**
 * Reorder nodes within each layer to minimize edge crossings using the
 * barycenter heuristic (Sugiyama framework).
 *
 * Performs alternating forward and backward sweeps. On each sweep, nodes in
 * a layer are sorted by the average position of their connections in the
 * adjacent (already-ordered) layer.
 *
 * Mutates `layerGroups` in place.
 *
 * @param layerGroups - Layer groups to reorder (mutated).
 * @param adjacency   - Forward adjacency list.
 * @param sweeps      - Number of forward+backward sweep pairs.
 */
function minimizeCrossings(
  layerGroups: number[][],
  adjacency: Set<number>[],
  sweeps: number = 4,
): void {
  if (layerGroups.length < 2) return;

  const reverse = buildReverseAdjacency(adjacency);

  for (let sweep = 0; sweep < sweeps; sweep++) {
    // Forward pass: sort each layer by predecessor barycenters
    for (let L = 1; L < layerGroups.length; L++) {
      const prevIndex = buildLayerIndex(layerGroups[L - 1]);
      layerGroups[L].sort((a, b) =>
        barycenter(a, reverse[a], prevIndex) - barycenter(b, reverse[b], prevIndex),
      );
    }

    // Backward pass: sort each layer by successor barycenters
    for (let L = layerGroups.length - 2; L >= 0; L--) {
      const nextIndex = buildLayerIndex(layerGroups[L + 1]);
      layerGroups[L].sort((a, b) =>
        barycenter(a, adjacency[a], nextIndex) - barycenter(b, adjacency[b], nextIndex),
      );
    }
  }
}

// ─── Layout Strategies ──────────────────────────────────────────────

/**
 * Lay states out left-to-right along `y = 0`, centred around `x = 0`.
 *
 * @param layerGroups - Each group must contain exactly 1 state index (chain shape).
 * @param spacing     - Horizontal distance between consecutive states.
 * @param out         - Position array to write into (mutated in place).
 */
function layoutChain(
  layerGroups: number[][],
  spacing: number,
  out: Position[],
): void {
  const count = layerGroups.length;
  const totalWidth = (count - 1) * spacing;
  const offsetX = -totalWidth / 2;

  for (let i = 0; i < count; i++) {
    out[layerGroups[i][0]] = {
      x: Math.round(offsetX + i * spacing),
      y: 0,
    };
  }
}

/**
 * Lay states out in columns by BFS depth, centred around the origin.
 *
 * Columns are spaced {@link hSpacing} apart horizontally; states within a
 * column are spaced {@link vSpacing} apart vertically and centred around
 * `y = 0`.
 *
 * @param layerGroups - State indices grouped by BFS depth.
 * @param hSpacing    - Horizontal distance between columns.
 * @param vSpacing    - Vertical distance between states in the same column.
 * @param out         - Position array to write into (mutated in place).
 */
function layoutLayered(
  layerGroups: number[][],
  hSpacing: number,
  vSpacing: number,
  out: Position[],
): void {
  const cols = layerGroups.length;
  const totalWidth = (cols - 1) * hSpacing;
  const offsetX = -totalWidth / 2;

  for (let col = 0; col < cols; col++) {
    const group = layerGroups[col];
    const totalHeight = (group.length - 1) * vSpacing;
    const offsetY = -totalHeight / 2;

    for (let row = 0; row < group.length; row++) {
      out[group[row]] = {
        x: Math.round(offsetX + col * hSpacing),
        y: Math.round(offsetY + row * vSpacing),
      };
    }
  }
}

/**
 * Lay states out evenly around a circle, ordered by BFS traversal so that
 * graph-neighbours tend to sit adjacent on the circle.
 *
 * @param orderedIndices - State indices in BFS visit order.
 * @param minStateWidth  - Minimum pixel width of a single state (for spacing).
 * @param out            - Position array to write into (mutated in place).
 */
function layoutCircle(
  orderedIndices: number[],
  minStateWidth: number,
  out: Position[],
): void {
  const count = orderedIndices.length;
  const circumferenceNeeded = count * (minStateWidth + 40);
  const radius = Math.max(150, circumferenceNeeded / (2 * Math.PI));

  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
    out[orderedIndices[i]] = {
      x: Math.round(radius * Math.cos(angle)),
      y: Math.round(radius * Math.sin(angle)),
    };
  }
}

// ─── Graph Construction ─────────────────────────────────────────────

/**
 * Build a directed adjacency list from index-based transitions.
 *
 * @param stateCount  - Total number of states.
 * @param transitions - Directed edges by index.
 * @returns An array of sets where `result[i]` contains the neighbour indices of state `i`.
 *
 * @example
 * ```ts
 * buildAdjacency(3, [{ sourceIndex: 0, targetIndex: 1 }]);
 * // [Set {1}, Set {}, Set {}]
 * ```
 */
function buildAdjacency(
  stateCount: number,
  transitions: LayoutTransition[],
): Set<number>[] {
  const adjacency: Set<number>[] = Array.from({ length: stateCount }, () => new Set());
  for (const { sourceIndex, targetIndex } of transitions) {
    adjacency[sourceIndex].add(targetIndex);
  }
  return adjacency;
}

// ─── Orchestration ──────────────────────────────────────────────────

/**
 * Position reachable states according to the classified graph shape.
 *
 * @param kind          - The detected layout shape.
 * @param layerGroups   - Reachable state indices grouped by BFS depth.
 * @param hSpacing      - Horizontal distance between columns/states.
 * @param vSpacing      - Vertical distance between states in the same column.
 * @param minStateWidth - Minimum pixel width of a single state (for circle radius).
 * @param out           - Position array to write into (mutated in place).
 */
function layoutReachable(
  kind: LayoutKind,
  layerGroups: number[][],
  hSpacing: number,
  vSpacing: number,
  minStateWidth: number,
  out: Position[],
): void {
  switch (kind) {
    case "chain":
      layoutChain(layerGroups, hSpacing, out);
      break;
    case "layered":
      layoutLayered(layerGroups, hSpacing, vSpacing, out);
      break;
    case "dense":
      layoutCircle(layerGroups.flat(), minStateWidth, out);
      break;
  }
}

/**
 * Place unreachable states in a horizontal row below the main layout.
 *
 * @param unreachable - Indices of unreachable states.
 * @param positions   - Position array (read for max-Y of reachable states, mutated for unreachable).
 * @param depths      - BFS depth array (`-1` marks unreachable states).
 * @param hSpacing    - Horizontal distance between states.
 */
function layoutUnreachable(
  unreachable: number[],
  positions: Position[],
  depths: Int32Array,
  hSpacing: number,
): void {
  let maxY = -Infinity;
  for (let i = 0; i < depths.length; i++) {
    if (depths[i] !== -1 && positions[i].y > maxY) {
      maxY = positions[i].y;
    }
  }
  if (maxY === -Infinity) maxY = 0;

  const unreachableY = maxY + hSpacing;
  const totalWidth = (unreachable.length - 1) * hSpacing;
  const offsetX = -totalWidth / 2;

  for (let i = 0; i < unreachable.length; i++) {
    positions[unreachable[i]] = {
      x: Math.round(offsetX + i * hSpacing),
      y: unreachableY,
    };
  }
}

/**
 * Compute dynamic spacing based on the graph's layer structure.
 *
 * Wider layers (more states in a column) get more vertical breathing room.
 * More layers get more horizontal spacing.
 *
 * @param layerGroups - Reachable states grouped by BFS depth.
 * @param baseH       - Base horizontal spacing.
 * @param baseV       - Base vertical spacing.
 * @returns Adjusted horizontal and vertical spacing.
 */
function computeDynamicSpacing(
  layerGroups: number[][],
  baseH: number,
  baseV: number,
): { hSpacing: number; vSpacing: number } {
  const maxWidth = Math.max(...layerGroups.map(g => g.length));
  const layerCount = layerGroups.length;

  const hSpacing = baseH + Math.max(0, layerCount - 3) * 20;
  const vSpacing = baseV + Math.max(0, maxWidth - 2) * 25;

  return { hSpacing, vSpacing };
}

/** Default horizontal spacing between columns/states. */
const DEFAULT_H_SPACING = 150;

/** Default vertical spacing between states in the same column. */
const DEFAULT_V_SPACING = 120;

/** Default minimum state width for circle layout radius calculation. */
const DEFAULT_MIN_STATE_WIDTH = 70;

/**
 * Compute positions for a set of automaton states using a hybrid layout
 * algorithm that adapts to the graph's shape.
 *
 * The algorithm:
 * 1. Builds a directed adjacency list from the transitions.
 * 2. Runs BFS from the start state to assign each reachable state a layer.
 * 3. Classifies the graph as **chain**, **layered**, or **dense**.
 * 4. For layered layouts, applies barycenter crossing minimization.
 * 5. Computes dynamic spacing based on layer structure.
 * 6. Positions reachable states using the appropriate strategy.
 * 7. Places unreachable states in a horizontal row below the main layout.
 *
 * @param stateCount   - Total number of states (indices `0 .. stateCount-1`).
 * @param startIndex   - Index of the start state (root for BFS).
 * @param transitions  - Directed edges by index (symbols are ignored for layout).
 * @param spacing      - Optional spacing overrides for wider state names.
 * @returns A position array where `result[i]` is the canvas position for state `i`.
 *
 * @example
 * ```ts
 * // Chain: 0 → 1 → 2
 * const pos = computeLayout(
 *   3,
 *   0,
 *   [{ sourceIndex: 0, targetIndex: 1 }, { sourceIndex: 1, targetIndex: 2 }],
 * );
 * // pos[0] → { x: -150, y: 0 }
 * // pos[1] → { x: 0,    y: 0 }
 * // pos[2] → { x: 150,  y: 0 }
 * ```
 */
export function computeLayout(
  stateCount: number,
  startIndex: number,
  transitions: LayoutTransition[],
  spacing?: LayoutSpacing,
): Position[] {
  const baseH = spacing?.hSpacing ?? DEFAULT_H_SPACING;
  const baseV = spacing?.vSpacing ?? DEFAULT_V_SPACING;

  const adjacency = buildAdjacency(stateCount, transitions);
  const depths = bfs(startIndex, adjacency);
  const layerGroups = groupByLayer(depths);
  const kind = classify(layerGroups, stateCount, computeBackEdgeRatio(transitions, depths));

  // Crossing minimization (only affects layered layouts)
  if (kind === "layered") {
    minimizeCrossings(layerGroups, adjacency);
  }

  // Scale spacing based on layer complexity
  const { hSpacing, vSpacing } = computeDynamicSpacing(layerGroups, baseH, baseV);
  const minStateWidth = Math.max(DEFAULT_MIN_STATE_WIDTH, hSpacing - 40);

  const positions: Position[] = new Array(stateCount);
  layoutReachable(kind, layerGroups, hSpacing, vSpacing, minStateWidth, positions);

  const unreachable: number[] = [];
  for (let i = 0; i < stateCount; i++) {
    if (depths[i] === -1) unreachable.push(i);
  }
  if (unreachable.length > 0) {
    layoutUnreachable(unreachable, positions, depths, hSpacing);
  }

  return positions;
}
