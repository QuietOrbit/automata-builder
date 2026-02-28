/**
 * Hybrid auto-layout for automata built from 5-tuples.
 *
 * All state references use numeric indices into the caller's state array.
 *
 * Two layout strategies, selected by graph structure:
 * - **Dominant-path chain:** For machines with a clear forward backbone
 *   (≥75% of states on longest path from start). Draws states horizontally
 *   with off-path states above/below their most-connected neighbor.
 * - **Force-directed (Fruchterman-Reingold):** For everything else. Physics
 *   simulation where states repel each other and edges attract connected
 *   states, naturally discovering grid-like, circular, or organic arrangements.
 *
 * Unreachable states are placed in a row beneath the main layout.
 *
 * @module layout
 */

import type { Position } from "~/types/automaton";
import { buildEdgeList, initCirclePositions, runSimulation } from "./force-simulation";

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

// ─── BFS ────────────────────────────────────────────────────────────

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

// ─── Dominant Path Detection ────────────────────────────────────────

/** Minimum fraction of reachable states that a path must cover to qualify as dominant. */
const DOMINANT_PATH_THRESHOLD = 0.6;

/**
 * Find the longest simple path from the start state using DFS with backtracking.
 *
 * Returns the path as an array of state indices if it covers at least 75% of
 * reachable states, or `null` otherwise. For small automata (<50 states),
 * exhaustive DFS is fast enough. A pruning check skips branches that cannot
 * beat the current best.
 *
 * @param start          - Index of the start state.
 * @param adjacency      - Directed adjacency list.
 * @param reachableCount - Number of reachable states (for threshold check).
 * @returns The longest path as state indices, or `null` if below threshold.
 */
export function findDominantPath(
  start: number,
  adjacency: Set<number>[],
  reachableCount: number,
): number[] | null {
  let bestPath: number[] = [];

  function dfs(current: number, path: number[], visited: Set<number>): void {
    if (path.length > bestPath.length) {
      bestPath = [...path];
    }
    // Early exit if we've covered all reachable states
    if (bestPath.length === reachableCount) return;

    for (const neighbor of adjacency[current]) {
      if (visited.has(neighbor)) continue;
      // Prune: remaining unvisited + current length can't beat best
      const remaining = reachableCount - visited.size;
      if (path.length + remaining <= bestPath.length) continue;

      visited.add(neighbor);
      path.push(neighbor);
      dfs(neighbor, path, visited);
      path.pop();
      visited.delete(neighbor);

      if (bestPath.length === reachableCount) return;
    }
  }

  const visited = new Set([start]);
  dfs(start, [start], visited);

  return bestPath.length / reachableCount >= DOMINANT_PATH_THRESHOLD ? bestPath : null;
}

/**
 * Maximum cross-path edges per path node before rejecting chain layout.
 *
 * Cross-path edges connect path nodes that are not adjacent on the path
 * (distance > 1). Graphs like grids or cliques have many of these, making
 * a linear layout misleading. Back-edges to adjacent path neighbors are
 * fine — they're natural in chains with cycles.
 */
const MAX_CROSS_EDGES_PER_NODE = 0.5;

/**
 * Check whether the dominant path captures the graph's edge structure well
 * enough for a chain layout.
 *
 * Counts edges between path nodes that skip over adjacent positions on the
 * path. For example, in path [0,1,2,3], edge 0→3 has distance 3, which is
 * a cross-path edge. Edge 2→0 (back-edge, distance 2) is also cross-path.
 * Only edge 0→1 or 2→1 (distance 1) are path-adjacent.
 *
 * If the ratio of cross-path edges to path length exceeds the threshold,
 * the graph is too densely connected for a chain layout.
 *
 * @param path      - The dominant path (state indices in order).
 * @param adjacency - Directed adjacency list.
 * @returns `true` if the graph is chain-like enough for linear layout.
 */
export function isChainLike(
  path: number[],
  adjacency: Set<number>[],
): boolean {
  if (path.length <= 2) return true;

  // Map each state to its position on the path
  const posOnPath = new Map<number, number>();
  for (let i = 0; i < path.length; i++) {
    posOnPath.set(path[i], i);
  }

  // Count edges between path nodes that skip over adjacent positions
  let crossEdges = 0;
  for (const src of path) {
    const srcPos = posOnPath.get(src)!;
    for (const tgt of adjacency[src]) {
      const tgtPos = posOnPath.get(tgt);
      if (tgtPos === undefined || src === tgt) continue;
      if (Math.abs(srcPos - tgtPos) > 1) crossEdges++;
    }
  }

  return crossEdges / path.length < MAX_CROSS_EDGES_PER_NODE;
}

// ─── Chain With Off-Path ────────────────────────────────────────────

/**
 * Count the number of directed edges between two states (in both directions).
 *
 * @param a         - First state index.
 * @param b         - Second state index.
 * @param adjacency - Directed adjacency list.
 * @returns Total edge count (0, 1, or 2).
 */
function countConnections(a: number, b: number, adjacency: Set<number>[]): number {
  let count = 0;
  if (adjacency[a].has(b)) count++;
  if (adjacency[b].has(a)) count++;
  return count;
}

/**
 * Find the path state that an off-path state is most connected to.
 *
 * @param offPathState - Index of the off-path state.
 * @param path         - State indices forming the chain backbone.
 * @param adjacency    - Directed adjacency list.
 * @returns Index of the best path neighbor within the path array (position, not state index).
 */
function findBestPathNeighbor(
  offPathState: number,
  path: number[],
  adjacency: Set<number>[],
): number {
  let bestPos = 0;
  let bestCount = -1;
  for (let i = 0; i < path.length; i++) {
    const c = countConnections(offPathState, path[i], adjacency);
    if (c > bestCount) {
      bestCount = c;
      bestPos = i;
    }
  }
  return bestPos;
}

/**
 * Lay out states along a horizontal chain with off-path states positioned
 * above or below near their most-connected path neighbor.
 *
 * Path states are placed on `y = 0`, evenly spaced horizontally, centered
 * around `x = 0`. Off-path states are placed at `±vSpacing` near their
 * best path neighbor, offset horizontally if multiple share the same neighbor.
 *
 * @param path      - State indices forming the chain backbone (left to right).
 * @param offPath   - State indices not on the main path.
 * @param adjacency - Directed adjacency list.
 * @param hSpacing  - Horizontal distance between chain states.
 * @param vSpacing  - Vertical offset for off-path states.
 * @param out       - Position array to write into (mutated in place).
 */
export function layoutChainWithOffPath(
  path: number[],
  offPath: number[],
  adjacency: Set<number>[],
  hSpacing: number,
  vSpacing: number,
  out: Position[],
): void {
  // Place path states on y=0, centered around x=0
  const totalWidth = (path.length - 1) * hSpacing;
  const offsetX = -totalWidth / 2;
  for (let i = 0; i < path.length; i++) {
    out[path[i]] = { x: Math.round(offsetX + i * hSpacing), y: 0 };
  }

  // Group off-path states by their best path neighbor position
  const groupedByNeighbor = new Map<number, number[]>();
  for (const state of offPath) {
    const neighborPos = findBestPathNeighbor(state, path, adjacency);
    const group = groupedByNeighbor.get(neighborPos);
    if (group) {
      group.push(state);
    }
    else {
      groupedByNeighbor.set(neighborPos, [state]);
    }
  }

  // Place off-path states above/below the chain
  for (const [neighborPos, states] of groupedByNeighbor) {
    const baseX = Math.round(offsetX + neighborPos * hSpacing);
    for (let i = 0; i < states.length; i++) {
      // Alternate above (-) and below (+), offset horizontally for multiple
      const ySign = i % 2 === 0 ? -1 : 1;
      const xOffset = Math.floor(i / 2) * Math.round(hSpacing / 2);
      out[states[i]] = {
        x: baseX + xOffset,
        y: Math.round(ySign * vSpacing),
      };
    }
  }
}

// ─── Force-Directed Layout ─────────────────────────────────────────

/**
 * Position states using Fruchterman-Reingold force-directed simulation.
 *
 * Delegates to the generic simulation engine in `force-simulation.ts`.
 * Computes the ideal distance from the state count and spacing, initializes
 * positions on a circle, runs the simulation, and writes results to the
 * output array.
 *
 * @param reachable - Indices of reachable states to position.
 * @param adjacency - Directed adjacency list.
 * @param hSpacing  - Target spacing between connected states.
 * @param out       - Position array to write into (mutated in place).
 */
export function layoutForceDirected(
  reachable: number[],
  adjacency: Set<number>[],
  hSpacing: number,
  out: Position[],
): void {
  const n = reachable.length;

  if (n <= 1) {
    for (const i of reachable) out[i] = { x: 0, y: 0 };
    return;
  }

  const area = (n * hSpacing) * (n * hSpacing);
  const k = Math.sqrt(area / n);

  const state = initCirclePositions(reachable, k, adjacency.length);
  const edges = buildEdgeList(reachable, adjacency);
  runSimulation(state, reachable, edges, k);

  for (const i of reachable) {
    out[i] = { x: state.posX[i], y: state.posY[i] };
  }
}

// ─── Post-Processing ────────────────────────────────────────────────

/**
 * Rotate all positions so the start state becomes the leftmost node.
 *
 * Computes the angle from the centroid to the start state, then rotates
 * all positions so that vector points left (π radians). This follows the
 * textbook convention of the start state on the left with an incoming arrow.
 *
 * Mutates `positions` in place.
 *
 * @param positions  - Position array to rotate (mutated).
 * @param reachable  - Indices of reachable states.
 * @param startIndex - Index of the start state.
 */
export function rotateStartLeft(
  positions: Position[],
  reachable: number[],
  startIndex: number,
): void {
  if (reachable.length <= 1) return;

  // Compute centroid of reachable states
  let cx = 0;
  let cy = 0;
  for (const i of reachable) {
    cx += positions[i].x;
    cy += positions[i].y;
  }
  cx /= reachable.length;
  cy /= reachable.length;

  // Angle from centroid to start state
  const dx = positions[startIndex].x - cx;
  const dy = positions[startIndex].y - cy;
  const currentAngle = Math.atan2(dy, dx);

  // Rotate so that angle becomes π (leftmost)
  const rotation = Math.PI - currentAngle;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (const i of reachable) {
    const rx = positions[i].x - cx;
    const ry = positions[i].y - cy;
    positions[i].x = cx + rx * cos - ry * sin;
    positions[i].y = cy + rx * sin + ry * cos;
  }
}

/**
 * Uniformly scale all positions so the average edge length matches the target.
 *
 * Computes the current average edge length among reachable states, then scales
 * all positions around the centroid to hit the target spacing. Preserves the
 * topology the simulation found — just normalizes density.
 *
 * Mutates `positions` in place. No-op if there are no edges between reachable states.
 *
 * @param positions     - Position array to scale (mutated).
 * @param reachable     - Indices of reachable states.
 * @param adjacency     - Directed adjacency list.
 * @param targetSpacing - Desired average edge length in pixels.
 */
export function scaleToTargetSpacing(
  positions: Position[],
  reachable: number[],
  adjacency: Set<number>[],
  targetSpacing: number,
): void {
  const reachableSet = new Set(reachable);
  let totalLength = 0;
  let edgeCount = 0;

  // Compute average edge length (deduplicated)
  const seen = new Set<string>();
  for (const a of reachable) {
    for (const b of adjacency[a]) {
      if (!reachableSet.has(b) || a === b) continue;
      const key = Math.min(a, b) + "," + Math.max(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      totalLength += Math.hypot(
        positions[a].x - positions[b].x,
        positions[a].y - positions[b].y,
      );
      edgeCount++;
    }
  }

  if (edgeCount === 0) return;

  const avgLength = totalLength / edgeCount;
  if (avgLength < 0.1) return;

  const scaleFactor = targetSpacing / avgLength;

  // Scale around centroid
  let cx = 0;
  let cy = 0;
  for (const i of reachable) {
    cx += positions[i].x;
    cy += positions[i].y;
  }
  cx /= reachable.length;
  cy /= reachable.length;

  for (const i of reachable) {
    positions[i].x = cx + (positions[i].x - cx) * scaleFactor;
    positions[i].y = cy + (positions[i].y - cy) * scaleFactor;
  }
}

// ─── Orchestration ──────────────────────────────────────────────────

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

/** Default horizontal spacing between columns/states. */
const DEFAULT_H_SPACING = 150;

/** Default vertical spacing between states in the same column. */
const DEFAULT_V_SPACING = 120;

/**
 * Compute positions for a set of automaton states using a hybrid layout
 * algorithm that adapts to the graph's shape.
 *
 * The algorithm:
 * 1. Builds a directed adjacency list from the transitions.
 * 2. Runs BFS from the start state to separate reachable vs unreachable states.
 * 3. Finds the dominant path (longest simple path from start via DFS).
 * 4. If the path covers ≥75% of reachable states → chain layout with off-path states.
 * 5. Otherwise → Fruchterman-Reingold force-directed simulation, then rotate
 *    start-left, scale to target spacing, and round to integers.
 * 6. Places unreachable states in a horizontal row below the main layout.
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

  // Separate reachable vs unreachable
  const reachable: number[] = [];
  const unreachable: number[] = [];
  for (let i = 0; i < stateCount; i++) {
    if (depths[i] === -1) {
      unreachable.push(i);
    }
    else {
      reachable.push(i);
    }
  }

  const positions: Position[] = new Array(stateCount);

  if (reachable.length <= 1) {
    for (const i of reachable) positions[i] = { x: 0, y: 0 };
  }
  else {
    const dominantPath = findDominantPath(startIndex, adjacency, reachable.length);

    if (dominantPath && isChainLike(dominantPath, adjacency)) {
      const pathSet = new Set(dominantPath);
      const offPath = reachable.filter(i => !pathSet.has(i));
      layoutChainWithOffPath(dominantPath, offPath, adjacency, baseH, baseV, positions);
    }
    else {
      layoutForceDirected(reachable, adjacency, baseH, positions);
      rotateStartLeft(positions, reachable, startIndex);
      scaleToTargetSpacing(positions, reachable, adjacency, baseH);
      // Round to integers for clean rendering
      for (const i of reachable) {
        positions[i].x = Math.round(positions[i].x);
        positions[i].y = Math.round(positions[i].y);
      }
    }
  }

  if (unreachable.length > 0) {
    layoutUnreachable(unreachable, positions, depths, baseH);
  }

  return positions;
}
