/**
 * Global arrow routing algorithm for automaton transitions.
 *
 * Assigns optimal connection angles to each transition based on 8 sectors
 * around each state. Self-loops pick the least congested sector, and
 * multiple arrows in the same sector spread by angular offset.
 *
 * Pure utility — no Vue or Pinia dependencies.
 *
 * @module routing
 */

import type { AutomatonState, Transition } from "~/types/automaton";

/** Number of sectors around each state. */
const SECTOR_COUNT = 8;

/** Angular width of each sector in radians (45 degrees). */
const SECTOR_WIDTH = (2 * Math.PI) / SECTOR_COUNT;

/** Half the angular width of a sector — the max deviation from sector center. */
const SECTOR_HALF_WIDTH = SECTOR_WIDTH / 2;

/** Center angle (radians) for each of the 8 sectors. */
export const SECTOR_ANGLES: readonly number[] = [
  -Math.PI / 2, // 0: N (top)
  -Math.PI / 4, // 1: NE
  0, // 2: E (right)
  Math.PI / 4, // 3: SE
  Math.PI / 2, // 4: S (bottom)
  (3 * Math.PI) / 4, // 5: SW
  Math.PI, // 6: W (left)
  (-3 * Math.PI) / 4, // 7: NW
];

/** Index of the W (left) sector where start arrows live. */
const START_ARROW_SECTOR = 6;

// ---------------------------------------------------------------------------
// Angle helpers
// ---------------------------------------------------------------------------

/** Normalize an angle to the range [-PI, PI). */
function normalizeAngle(angle: number): number {
  let a = angle % (2 * Math.PI);
  if (a >= Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Map an angle in radians to the nearest sector index (0-7). */
function angleToSector(angle: number): number {
  const normalized = normalizeAngle(angle);
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < SECTOR_COUNT; i++) {
    const diff = Math.abs(normalizeAngle(normalized - SECTOR_ANGLES[i]));
    if (diff < bestDist) {
      bestDist = diff;
      best = i;
    }
  }
  return best;
}

/**
 * Clamp an angle so it stays within ±half-sector-width of its sector center.
 * Prevents arrows from crossing into adjacent (or opposite) sectors.
 */
function clampToSector(angle: number, sectorCenter: number): number {
  const diff = normalizeAngle(angle - sectorCenter);
  const clamped = Math.max(-SECTOR_HALF_WIDTH, Math.min(SECTOR_HALF_WIDTH, diff));
  return normalizeAngle(sectorCenter + clamped);
}

/**
 * Find the sector with the lowest occupancy, excluding specific sectors.
 * Ties are broken by preferring top (0), then cycling through sectors.
 */
function findLeastOccupiedSector(occupancy: number[], excluded: Set<number>): number {
  let best = -1;
  let bestCount = Infinity;
  const preferenceOrder = [0, 4, 2, 6, 1, 3, 5, 7]; // N, S, E, W, then diagonals
  for (const i of preferenceOrder) {
    if (excluded.has(i)) continue;
    if (occupancy[i] < bestCount) {
      bestCount = occupancy[i];
      best = i;
    }
  }
  if (best === -1) {
    for (let i = 0; i < SECTOR_COUNT; i++) {
      if (occupancy[i] < bestCount) {
        bestCount = occupancy[i];
        best = i;
      }
    }
  }
  return best === -1 ? 0 : best;
}

/**
 * Spread multiple angles within a sector's 45-degree span.
 * Returns evenly distributed angles centered on the sector.
 */
function spreadAnglesInSector(
  naturalAngles: number[],
  sectorCenter: number,
): number[] {
  const count = naturalAngles.length;
  if (count <= 1) return naturalAngles;

  const maxSpread = SECTOR_WIDTH * 0.7; // Use 70% of sector width
  const step = maxSpread / count;
  const startOffset = -maxSpread / 2 + step / 2;

  const sorted = [...naturalAngles].sort((a, b) => a - b);
  return sorted.map((_, i) => clampToSector(sectorCenter + startOffset + i * step, sectorCenter));
}

// ---------------------------------------------------------------------------
// Routing internals
// ---------------------------------------------------------------------------

/** A pending arrow awaiting angle assignment. */
interface PendingArrow {
  transition: Transition;
  stateId: string;
  side: "source" | "target";
  naturalAngle: number;
  sector: number;
}

/** Build a per-state occupancy map, pre-seeding start arrow slots. */
function buildOccupancyMap(states: readonly AutomatonState[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const s of states) {
    const occupancy = new Array<number>(SECTOR_COUNT).fill(0);
    if (s.isStart) {
      occupancy[START_ARROW_SECTOR]++;
    }
    map.set(s.id, occupancy);
  }
  return map;
}

/**
 * Partition transitions into self-loops and regular (non-self-loop) transitions.
 * Pinned transitions are excluded from both lists.
 */
function partitionTransitions(transitions: Transition[]): {
  selfLoops: Transition[];
  regular: Transition[];
} {
  const selfLoops: Transition[] = [];
  const regular: Transition[] = [];
  for (const t of transitions) {
    if (t.route?.pinned) continue;
    if (t.sourceId === t.targetId) {
      selfLoops.push(t);
    }
    else {
      regular.push(t);
    }
  }
  return { selfLoops, regular };
}

/** Count pinned routes into the occupancy map so unpinned arrows avoid them. */
function countPinnedOccupancy(
  transitions: Transition[],
  occupancy: Map<string, number[]>,
): void {
  for (const t of transitions) {
    if (!t.route?.pinned) continue;
    if (t.sourceId === t.targetId) {
      const slot = t.route.selfLoopSlot ?? 0;
      const occ = occupancy.get(t.sourceId);
      if (occ) occ[slot]++;
    }
    else {
      countPinnedEndpoint(t.route.sourceAngle, t.sourceId, occupancy);
      countPinnedEndpoint(t.route.targetAngle, t.targetId, occupancy);
    }
  }
}

/** Increment occupancy for a single pinned endpoint angle. */
function countPinnedEndpoint(
  angleDeg: number | undefined,
  stateId: string,
  occupancy: Map<string, number[]>,
): void {
  if (angleDeg === undefined) return;
  const sector = angleToSector(angleDeg * (Math.PI / 180));
  const occ = occupancy.get(stateId);
  if (occ) occ[sector]++;
}

/**
 * Build pending arrows for all regular transitions, recording the natural
 * angle and sector for each endpoint. Increments occupancy as a side effect.
 */
function buildPendingArrows(
  regular: Transition[],
  stateById: Map<string, AutomatonState>,
  occupancy: Map<string, number[]>,
): PendingArrow[] {
  const pending: PendingArrow[] = [];

  for (const t of regular) {
    const source = stateById.get(t.sourceId);
    const target = stateById.get(t.targetId);
    if (!source || !target) continue;

    const angle = Math.atan2(
      target.position.y - source.position.y,
      target.position.x - source.position.x,
    );
    const reverseAngle = normalizeAngle(angle + Math.PI);
    const sourceSector = angleToSector(angle);
    const targetSector = angleToSector(reverseAngle);

    pending.push(
      { transition: t, stateId: source.id, side: "source", naturalAngle: angle, sector: sourceSector },
      { transition: t, stateId: target.id, side: "target", naturalAngle: reverseAngle, sector: targetSector },
    );

    const sourceOcc = occupancy.get(source.id);
    if (sourceOcc) sourceOcc[sourceSector]++;
    const targetOcc = occupancy.get(target.id);
    if (targetOcc) targetOcc[targetSector]++;
  }

  return pending;
}

/** Group pending arrows by (stateId, sector) key for spreading. */
function groupByStateSector(arrows: PendingArrow[]): Map<string, PendingArrow[]> {
  const groups = new Map<string, PendingArrow[]>();
  for (const arrow of arrows) {
    const key = `${arrow.stateId}:${arrow.sector}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(arrow);
    }
    else {
      groups.set(key, [arrow]);
    }
  }
  return groups;
}

/** Write a resolved angle (degrees) onto a pending arrow's transition route. */
function writeAngle(arrow: PendingArrow, angleDeg: number): void {
  if (!arrow.transition.route) arrow.transition.route = {};
  if (arrow.side === "source") {
    arrow.transition.route.sourceAngle = angleDeg;
  }
  else {
    arrow.transition.route.targetAngle = angleDeg;
  }
}

/** Assign clamped angles to each group, spreading when multiple arrows share a sector. */
function assignAnglesFromGroups(groups: Map<string, PendingArrow[]>): void {
  for (const [, group] of groups) {
    const sectorCenter = SECTOR_ANGLES[group[0].sector];

    if (group.length <= 1) {
      for (const arrow of group) {
        const clamped = clampToSector(arrow.naturalAngle, sectorCenter);
        writeAngle(arrow, clamped * (180 / Math.PI));
      }
    }
    else {
      const naturalAngles = group.map(a => a.naturalAngle);
      const spread = spreadAnglesInSector(naturalAngles, sectorCenter);
      for (let i = 0; i < group.length; i++) {
        writeAngle(group[i], spread[i] * (180 / Math.PI));
      }
    }
  }
}

/** Assign each self-loop to the least occupied sector on its state. */
function assignSelfLoopSlots(
  selfLoops: Transition[],
  occupancy: Map<string, number[]>,
  stateById: Map<string, AutomatonState>,
): void {
  for (const t of selfLoops) {
    const occ = occupancy.get(t.sourceId);
    if (!occ) continue;

    const excluded = new Set<number>();
    const state = stateById.get(t.sourceId);
    if (state?.isStart) {
      excluded.add(START_ARROW_SECTOR);
    }

    const slot = findLeastOccupiedSector(occ, excluded);
    occ[slot]++;
    t.route = { ...t.route, selfLoopSlot: slot };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the global routing algorithm. Mutates transitions in place,
 * writing route data to each transition's `route` field.
 *
 * Pinned routes (route.pinned === true) are preserved unchanged.
 *
 * @param states - All states in the automaton.
 * @param transitions - All transitions (mutated in place with route data).
 */
export function computeRouting(
  states: readonly AutomatonState[],
  transitions: Transition[],
): void {
  if (states.length === 0) return;

  const stateById = new Map<string, AutomatonState>();
  for (const s of states) stateById.set(s.id, s);

  const occupancy = buildOccupancyMap(states);
  const { selfLoops, regular } = partitionTransitions(transitions);

  countPinnedOccupancy(transitions, occupancy);

  const pending = buildPendingArrows(regular, stateById, occupancy);
  const groups = groupByStateSector(pending);
  assignAnglesFromGroups(groups);

  assignSelfLoopSlots(selfLoops, occupancy, stateById);
}
