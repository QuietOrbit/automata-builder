/**
 * Fruchterman-Reingold force-directed graph layout simulation.
 *
 * A general-purpose physics engine that positions nodes by balancing
 * repulsive forces (all pairs) and attractive forces (edges). Bidirectional
 * edges receive extra attraction weight. Temperature decreases linearly
 * for gradual stabilization.
 *
 * @module force-simulation
 */

/** Number of simulation iterations. */
const FR_ITERATIONS = 200;

/** Attraction multiplier for bidirectional edges. */
const BIDIR_WEIGHT = 1.5;

/** Minimum distance to prevent division by zero. */
const MIN_DIST = 0.1;

/** A weighted edge between two node indices. */
export interface SimEdge {
  a: number;
  b: number;
  weight: number;
}

/** Mutable x/y position arrays for simulation state. */
export interface SimState {
  posX: Float64Array;
  posY: Float64Array;
}

// ─── Force Computation ─────────────────────────────────────────────

/**
 * Compute the repulsive force vector between two nodes.
 *
 * Fruchterman-Reingold repulsion: `F = k² / dist`, directed away from the other node.
 *
 * @param dx   - Horizontal distance (from other to this).
 * @param dy   - Vertical distance (from other to this).
 * @param dist - Euclidean distance between the nodes.
 * @param k    - Ideal inter-node distance.
 * @returns Force vector `{ fx, fy }` to apply to the first node.
 */
function computeRepulsion(
  dx: number,
  dy: number,
  dist: number,
  k: number,
): { fx: number; fy: number } {
  const force = (k * k) / dist;
  return { fx: (dx / dist) * force, fy: (dy / dist) * force };
}

/**
 * Compute the attractive force vector along an edge.
 *
 * Fruchterman-Reingold attraction: `F = dist² / k`, directed toward the other node.
 *
 * @param dx     - Horizontal distance (from this to other).
 * @param dy     - Vertical distance (from this to other).
 * @param dist   - Euclidean distance between the nodes.
 * @param k      - Ideal inter-node distance.
 * @param weight - Edge weight multiplier (1.5 for bidirectional).
 * @returns Force vector `{ fx, fy }` to apply to the source node.
 */
function computeAttraction(
  dx: number,
  dy: number,
  dist: number,
  k: number,
  weight: number,
): { fx: number; fy: number } {
  const force = (dist * dist) / k * weight;
  return { fx: (dx / dist) * force, fy: (dy / dist) * force };
}

// ─── Force Application ─────────────────────────────────────────────

/**
 * Apply repulsive forces between all pairs of nodes.
 *
 * @param state - Mutable simulation state (positions).
 * @param dispX - X displacement accumulators (mutated).
 * @param dispY - Y displacement accumulators (mutated).
 * @param nodes - Indices of nodes in the simulation.
 * @param k     - Ideal inter-node distance.
 */
function applyRepulsion(
  state: SimState,
  dispX: Float64Array,
  dispY: Float64Array,
  nodes: number[],
  k: number,
): void {
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const dx = state.posX[a] - state.posX[b];
      const dy = state.posY[a] - state.posY[b];
      const dist = Math.max(Math.hypot(dx, dy), MIN_DIST);
      const { fx, fy } = computeRepulsion(dx, dy, dist, k);
      dispX[a] += fx;
      dispY[a] += fy;
      dispX[b] -= fx;
      dispY[b] -= fy;
    }
  }
}

/**
 * Apply attractive forces along all edges.
 *
 * @param state - Mutable simulation state (positions).
 * @param dispX - X displacement accumulators (mutated).
 * @param dispY - Y displacement accumulators (mutated).
 * @param edges - Weighted edge list.
 * @param k     - Ideal inter-node distance.
 */
function applyAttraction(
  state: SimState,
  dispX: Float64Array,
  dispY: Float64Array,
  edges: SimEdge[],
  k: number,
): void {
  for (const { a, b, weight } of edges) {
    const dx = state.posX[b] - state.posX[a];
    const dy = state.posY[b] - state.posY[a];
    const dist = Math.max(Math.hypot(dx, dy), MIN_DIST);
    const { fx, fy } = computeAttraction(dx, dy, dist, k, weight);
    dispX[a] += fx;
    dispY[a] += fy;
    dispX[b] -= fx;
    dispY[b] -= fy;
  }
}

// ─── Initialization ────────────────────────────────────────────────

/**
 * Place nodes evenly on a circle of radius `k` as the simulation starting point.
 *
 * A circle is a deterministic, unbiased initial position — no node gets a
 * positional advantage, so the simulation converges based purely on the
 * graph's edge structure.
 *
 * @param nodes      - Indices of nodes to initialize.
 * @param k          - Circle radius (ideal inter-node distance).
 * @param totalSlots - Total array size (may be larger than nodes.length).
 * @returns Mutable simulation state with initialized positions.
 */
export function initCirclePositions(
  nodes: number[],
  k: number,
  totalSlots: number,
): SimState {
  const posX = new Float64Array(totalSlots);
  const posY = new Float64Array(totalSlots);
  const n = nodes.length;

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    posX[nodes[i]] = k * Math.cos(angle);
    posY[nodes[i]] = k * Math.sin(angle);
  }

  return { posX, posY };
}

/**
 * Build a deduplicated, weighted edge list from a directed adjacency list.
 *
 * Each undirected pair (a, b) appears once. Bidirectional edges (both a→b
 * and b→a exist) receive {@link BIDIR_WEIGHT}; unidirectional edges get 1.0.
 * Self-loops and edges to nodes outside `nodeSet` are excluded.
 *
 * @param nodes     - Indices of nodes to include.
 * @param adjacency - Directed adjacency list (node → set of neighbors).
 * @returns Deduplicated weighted edge list.
 */
export function buildEdgeList(
  nodes: number[],
  adjacency: Set<number>[],
): SimEdge[] {
  const nodeSet = new Set(nodes);
  const seen = new Set<string>();
  const edges: SimEdge[] = [];

  for (const a of nodes) {
    for (const b of adjacency[a]) {
      if (!nodeSet.has(b) || a === b) continue;
      const key = Math.min(a, b) + "," + Math.max(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      const bidir = adjacency[a].has(b) && adjacency[b].has(a);
      edges.push({ a, b, weight: bidir ? BIDIR_WEIGHT : 1 });
    }
  }

  return edges;
}

// ─── Simulation Loop ───────────────────────────────────────────────

/**
 * Run the Fruchterman-Reingold simulation loop.
 *
 * Each iteration: reset displacements → compute repulsion (all pairs) →
 * compute attraction (edges) → apply clamped displacements → cool temperature.
 *
 * Mutates `state` positions in place.
 *
 * @param state - Mutable simulation state (positions are updated).
 * @param nodes - Indices of nodes in the simulation.
 * @param edges - Weighted edge list.
 * @param k     - Ideal inter-node distance.
 */
export function runSimulation(
  state: SimState,
  nodes: number[],
  edges: SimEdge[],
  k: number,
): void {
  const totalSlots = state.posX.length;
  const startTemp = k * 2;
  let temp = startTemp;
  const dispX = new Float64Array(totalSlots);
  const dispY = new Float64Array(totalSlots);

  for (let iter = 0; iter < FR_ITERATIONS; iter++) {
    dispX.fill(0);
    dispY.fill(0);

    applyRepulsion(state, dispX, dispY, nodes, k);
    applyAttraction(state, dispX, dispY, edges, k);

    for (const i of nodes) {
      const dispLen = Math.max(Math.hypot(dispX[i], dispY[i]), MIN_DIST);
      const clamp = Math.min(dispLen, temp) / dispLen;
      state.posX[i] += dispX[i] * clamp;
      state.posY[i] += dispY[i] * clamp;
    }

    temp -= startTemp / FR_ITERATIONS;
  }
}
