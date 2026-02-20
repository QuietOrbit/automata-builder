/**
 * Hybrid auto-layout for automata built from 5-tuples.
 *
 * All state references use numeric indices into the caller's state array.
 *
 * Analyses the graph structure via BFS from the start state, classifies the
 * shape as **chain**, **layered**, or **dense**, and returns positions tuned
 * to that shape. Unreachable states are placed in a row beneath the main
 * layout.
 *
 * @module layout
 */

import type { Position } from '~/types/automaton'

/** Directed edge described by indices into the state array. */
export interface LayoutTransition {
  sourceIndex: number
  targetIndex: number
}

/** The three recognised graph shapes. */
type LayoutKind = 'chain' | 'layered' | 'dense'

/**
 * Run a breadth-first search from {@link start} over the directed graph
 * described by {@link adjacency} and return the BFS depth of every reachable
 * node.
 *
 * @param start      - Index of the start state.
 * @param adjacency  - Directed adjacency list (state index → set of neighbour indices).
 * @returns An array mapping state index to BFS depth, or `-1` if unreachable.
 *          Only indices present in {@link adjacency} are meaningful.
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
  const depths = new Int32Array(adjacency.length).fill(-1)
  depths[start] = 0
  const queue: number[] = [start]

  while (queue.length > 0) {
    const current = queue.shift()!
    const depth = depths[current]
    for (const neighbour of adjacency[current]) {
      if (depths[neighbour] === -1) {
        depths[neighbour] = depth + 1
        queue.push(neighbour)
      }
    }
  }

  return depths
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
  const groups: number[][] = []
  for (let i = 0; i < depths.length; i++) {
    const depth = depths[i]
    if (depth === -1) continue
    while (groups.length <= depth) groups.push([])
    groups[depth].push(i)
  }
  return groups
}

/**
 * Check whether any transition would cause an arrow to pass through an
 * intermediate state in a collinear (chain) layout. This includes back-edges
 * (target at an earlier BFS layer) and skip-edges (depth difference > 1).
 *
 * Self-loops are ignored because they render as small arcs on the state
 * itself and never overlap other states.
 *
 * @param transitions - Directed edges by index.
 * @param depths      - BFS depth array (`-1` = unreachable).
 * @returns `true` if at least one overlapping edge exists among reachable states.
 *
 * @example
 * ```ts
 * // q0(0) → q1(1) → q2(2) → q0(0) — back-edge from q2 to q0
 * hasOverlappingEdges(
 *   [{ sourceIndex: 0, targetIndex: 1 }, { sourceIndex: 1, targetIndex: 2 }, { sourceIndex: 2, targetIndex: 0 }],
 *   Int32Array.from([0, 1, 2]),
 * ); // true
 *
 * // Self-loops are not overlapping
 * hasOverlappingEdges(
 *   [{ sourceIndex: 0, targetIndex: 0 }, { sourceIndex: 0, targetIndex: 1 }],
 *   Int32Array.from([0, 1]),
 * ); // false
 * ```
 */
function hasOverlappingEdges(
  transitions: LayoutTransition[],
  depths: Int32Array,
): boolean {
  for (const { sourceIndex, targetIndex } of transitions) {
    if (sourceIndex === targetIndex) continue
    if (depths[sourceIndex] === -1 || depths[targetIndex] === -1) continue
    const diff = depths[targetIndex] - depths[sourceIndex]
    if (diff !== 1) return true
  }
  return false
}

/**
 * Classify the graph shape based on the BFS layer groups and total state
 * count.
 *
 * - **chain** — every BFS layer has exactly 1 state and all transitions go
 *   to the immediately next layer (no back-edges or layer-skipping edges).
 * - **layered** — multiple BFS layers exist and at least one has more than
 *   1 state.
 * - **dense** — only 0–1 BFS layers for a graph with more than 2 states
 *   (nearly everything is one hop from start), *or* only 1 reachable state
 *   with many unreachable ones, *or* a would-be chain that contains
 *   back-edges / skip-edges.
 *
 * @param layerGroups    - Reachable states grouped by BFS depth.
 * @param totalStates    - Total number of states (reachable + unreachable).
 * @param hasOverlapping - Whether the graph has edges that would overlap
 *                         intermediate states in a collinear layout.
 * @returns The detected layout kind.
 *
 * @example
 * ```ts
 * classify([[0], [1], [2]], 3, false); // 'chain'
 * classify([[0], [1], [2]], 3, true);  // 'dense' (back-edge)
 * classify([[0], [1, 2]], 3, false);   // 'layered'
 * classify([[0, 1, 2]], 3, false);     // 'dense'
 * ```
 */
function classify(
  layerGroups: number[][],
  totalStates: number,
  hasOverlapping: boolean,
): LayoutKind {
  if (layerGroups.length <= 1 && totalStates > 2) return 'dense'

  const maxWidth = Math.max(...layerGroups.map(g => g.length))
  if (maxWidth === 1 && !hasOverlapping) return 'chain'
  if (maxWidth === 1) return 'dense'
  return 'layered'
}

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
  const count = layerGroups.length
  const totalWidth = (count - 1) * spacing
  const offsetX = -totalWidth / 2

  for (let i = 0; i < count; i++) {
    out[layerGroups[i][0]] = {
      x: Math.round(offsetX + i * spacing),
      y: 0,
    }
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
  const cols = layerGroups.length
  const totalWidth = (cols - 1) * hSpacing
  const offsetX = -totalWidth / 2

  for (let col = 0; col < cols; col++) {
    const group = layerGroups[col]
    const totalHeight = (group.length - 1) * vSpacing
    const offsetY = -totalHeight / 2

    for (let row = 0; row < group.length; row++) {
      out[group[row]] = {
        x: Math.round(offsetX + col * hSpacing),
        y: Math.round(offsetY + row * vSpacing),
      }
    }
  }
}

/**
 * Lay states out evenly around a circle, ordered by BFS traversal so that
 * graph-neighbours tend to sit adjacent on the circle.
 *
 * @param orderedIndices - State indices in BFS visit order.
 * @param out            - Position array to write into (mutated in place).
 */
function layoutCircle(
  orderedIndices: number[],
  out: Position[],
): void {
  const count = orderedIndices.length
  const radius = Math.max(150, (80 * count) / Math.PI)

  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count
    out[orderedIndices[i]] = {
      x: Math.round(radius * Math.cos(angle)),
      y: Math.round(radius * Math.sin(angle)),
    }
  }
}

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
  const adjacency: Set<number>[] = Array.from({ length: stateCount }, () => new Set())
  for (const { sourceIndex, targetIndex } of transitions) {
    adjacency[sourceIndex].add(targetIndex)
  }
  return adjacency
}

/**
 * Position reachable states according to the classified graph shape.
 *
 * @param kind        - The detected layout shape.
 * @param layerGroups - Reachable state indices grouped by BFS depth.
 * @param out         - Position array to write into (mutated in place).
 */
function layoutReachable(
  kind: LayoutKind,
  layerGroups: number[][],
  out: Position[],
): void {
  switch (kind) {
    case 'chain':
      layoutChain(layerGroups, 150, out)
      break
    case 'layered':
      layoutLayered(layerGroups, 150, 120, out)
      break
    case 'dense':
      layoutCircle(layerGroups.flat(), out)
      break
  }
}

/**
 * Place unreachable states in a horizontal row below the main layout.
 *
 * @param unreachable - Indices of unreachable states.
 * @param positions   - Position array (read for max-Y of reachable states, mutated for unreachable).
 * @param depths      - BFS depth array (`-1` marks unreachable states).
 */
function layoutUnreachable(
  unreachable: number[],
  positions: Position[],
  depths: Int32Array,
): void {
  let maxY = -Infinity
  for (let i = 0; i < depths.length; i++) {
    if (depths[i] !== -1 && positions[i].y > maxY) {
      maxY = positions[i].y
    }
  }
  if (maxY === -Infinity) maxY = 0

  const unreachableY = maxY + 150
  const totalWidth = (unreachable.length - 1) * 150
  const offsetX = -totalWidth / 2

  for (let i = 0; i < unreachable.length; i++) {
    positions[unreachable[i]] = {
      x: Math.round(offsetX + i * 150),
      y: unreachableY,
    }
  }
}

/**
 * Compute positions for a set of automaton states using a hybrid layout
 * algorithm that adapts to the graph's shape.
 *
 * The algorithm:
 * 1. Builds a directed adjacency list from the transitions.
 * 2. Runs BFS from the start state to assign each reachable state a layer.
 * 3. Classifies the graph as **chain**, **layered**, or **dense**.
 * 4. Positions reachable states using the appropriate strategy.
 * 5. Places unreachable states in a horizontal row below the main layout.
 *
 * @param stateCount   - Total number of states (indices `0 .. stateCount-1`).
 * @param startIndex   - Index of the start state (root for BFS).
 * @param transitions  - Directed edges by index (symbols are ignored for layout).
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
): Position[] {
  const adjacency = buildAdjacency(stateCount, transitions)
  const depths = bfs(startIndex, adjacency)
  const layerGroups = groupByLayer(depths)
  const kind = classify(layerGroups, stateCount, hasOverlappingEdges(transitions, depths))

  const positions: Position[] = new Array(stateCount)
  layoutReachable(kind, layerGroups, positions)

  const unreachable: number[] = []
  for (let i = 0; i < stateCount; i++) {
    if (depths[i] === -1) unreachable.push(i)
  }
  if (unreachable.length > 0) {
    layoutUnreachable(unreachable, positions, depths)
  }

  return positions
}
