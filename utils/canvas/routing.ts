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

import type { AutomatonState, Transition, TransitionRoute } from "~/types/automaton";

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
    const sectorAngle = SECTOR_ANGLES.at(i) ?? 0;
    const diff = Math.abs(normalizeAngle(normalized - sectorAngle));
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
function findLeastOccupiedSector(occupancy: Map<number, number>, excluded: Set<number>): number {
  let best = -1;
  let bestCount = Infinity;
  const preferenceOrder = [0, 4, 2, 6, 1, 3, 5, 7]; // N, S, E, W, then diagonals
  for (const i of preferenceOrder) {
    if (excluded.has(i)) continue;
    const count = occupancy.get(i) ?? 0;
    if (count < bestCount) {
      bestCount = count;
      best = i;
    }
  }
  if (best === -1) {
    for (let i = 0; i < SECTOR_COUNT; i++) {
      const count = occupancy.get(i) ?? 0;
      if (count < bestCount) {
        bestCount = count;
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
function buildOccupancyMap(states: readonly AutomatonState[]): Map<string, Map<number, number>> {
  const map = new Map<string, Map<number, number>>();
  for (const s of states) {
    const occupancy = new Map<number, number>();
    for (let i = 0; i < SECTOR_COUNT; i++) occupancy.set(i, 0);
    if (s.isStart) {
      occupancy.set(START_ARROW_SECTOR, (occupancy.get(START_ARROW_SECTOR) ?? 0) + 1);
    }
    map.set(s.id, occupancy);
  }
  return map;
}

/**
 * Partition transitions into self-loops and regular (non-self-loop) transitions.
 * Pinned transitions are excluded from both lists.
 */
function partitionTransitions(transitions: readonly Transition[]): {
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
  transitions: readonly Transition[],
  occupancy: Map<string, Map<number, number>>,
): void {
  for (const t of transitions) {
    if (!t.route?.pinned) continue;
    if (t.sourceId === t.targetId) {
      const slot = t.route.selfLoopSlot ?? 0;
      const occ = occupancy.get(t.sourceId);
      if (occ) occ.set(slot, (occ.get(slot) ?? 0) + 1);
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
  occupancy: Map<string, Map<number, number>>,
): void {
  if (angleDeg === undefined) return;
  const sector = angleToSector(angleDeg * (Math.PI / 180));
  const occ = occupancy.get(stateId);
  if (occ) occ.set(sector, (occ.get(sector) ?? 0) + 1);
}

/**
 * Build pending arrows for all regular transitions, recording the natural
 * angle and sector for each endpoint. Increments occupancy as a side effect.
 */
function buildPendingArrows(
  regular: Transition[],
  stateById: Map<string, AutomatonState>,
  occupancy: Map<string, Map<number, number>>,
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
    if (sourceOcc) sourceOcc.set(sourceSector, (sourceOcc.get(sourceSector) ?? 0) + 1);
    const targetOcc = occupancy.get(target.id);
    if (targetOcc) targetOcc.set(targetSector, (targetOcc.get(targetSector) ?? 0) + 1);
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

/** Write a resolved angle (degrees) into the results map for a pending arrow's transition. */
function writeAngle(
  arrow: PendingArrow,
  angleDeg: number,
  results: Map<string, TransitionRoute>,
): void {
  let route = results.get(arrow.transition.id);
  if (!route) {
    route = {};
    results.set(arrow.transition.id, route);
  }
  if (arrow.side === "source") {
    route.sourceAngle = angleDeg;
  }
  else {
    route.targetAngle = angleDeg;
  }
}

/** Assign clamped angles to each group, spreading when multiple arrows share a sector. */
function assignAnglesFromGroups(
  groups: Map<string, PendingArrow[]>,
  results: Map<string, TransitionRoute>,
): void {
  for (const [, group] of groups) {
    const firstArrow = group.at(0);
    if (!firstArrow) continue;
    const sectorCenter = SECTOR_ANGLES.at(firstArrow.sector) ?? 0;

    if (group.length <= 1) {
      for (const arrow of group) {
        const clamped = clampToSector(arrow.naturalAngle, sectorCenter);
        writeAngle(arrow, clamped * (180 / Math.PI), results);
      }
    }
    else {
      const naturalAngles = group.map(a => a.naturalAngle);
      const spread = spreadAnglesInSector(naturalAngles, sectorCenter);
      for (const [i, arrow] of group.entries()) {
        const angle = spread.at(i) ?? 0;
        writeAngle(arrow, angle * (180 / Math.PI), results);
      }
    }
  }
}

/** Assign each self-loop to the least occupied sector on its state. */
function assignSelfLoopSlots(
  selfLoops: Transition[],
  occupancy: Map<string, Map<number, number>>,
  stateById: Map<string, AutomatonState>,
  results: Map<string, TransitionRoute>,
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
    occ.set(slot, (occ.get(slot) ?? 0) + 1);
    results.set(t.id, { selfLoopSlot: slot });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the global routing algorithm. Returns a map from transition ID
 * to resolved route data, without mutating the input transitions.
 *
 * Pinned routes (route.pinned === true) are preserved unchanged and
 * copied into the result map as-is.
 *
 * @param states - All states in the automaton.
 * @param transitions - All transitions (read-only, not mutated).
 * @returns Map from transition ID to computed TransitionRoute.
 */
export function computeRouting(
  states: readonly AutomatonState[],
  transitions: readonly Transition[],
): Map<string, TransitionRoute> {
  const results = new Map<string, TransitionRoute>();
  if (states.length === 0) return results;

  const stateById = new Map<string, AutomatonState>();
  for (const s of states) stateById.set(s.id, s);

  const occupancy = buildOccupancyMap(states);
  const { selfLoops, regular } = partitionTransitions(transitions);

  // Copy pinned routes into results and count their occupancy
  for (const t of transitions) {
    if (t.route?.pinned) {
      results.set(t.id, { ...t.route });
    }
  }
  countPinnedOccupancy(transitions, occupancy);

  const pending = buildPendingArrows(regular, stateById, occupancy);
  const groups = groupByStateSector(pending);
  assignAnglesFromGroups(groups, results);

  assignSelfLoopSlots(selfLoops, occupancy, stateById, results);

  return results;
}
