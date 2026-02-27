/**
 * Collision detection and resolution for automaton layout.
 *
 * Pure utility functions — no Vue or Pinia dependencies.
 *
 * @module collision
 */

import type { AutomatonState, Position, Transition, TransitionRoute } from "~/types/automaton";
import {
  STATE_RADIUS,
  SELF_LOOP_RADIUS,
  START_ARROW_LENGTH,
} from "~/utils/geometry";
import { SECTOR_ANGLES } from "~/utils/routing";

/** Axis-aligned bounding box. */
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Minimal visual info needed to compute a state's full bounding box. */
export interface StateVisualInfo {
  position: Position;
  hasSelfLoop: boolean;
  isStart: boolean;
  selfLoopLabelWidth: number;
  /** Estimated pixel width of the state name label. */
  nameLabelWidth: number;
  /** Sector slot for self-loop placement (0-7). Defaults to 0 (top). */
  selfLoopSlot: number;
}

/** Approximate character width (px) for estimating label text extent. */
const CHAR_WIDTH = 8;

/**
 * Estimate the pixel width of a state name label.
 *
 * Uses the same font-size breakpoints as StateNode.vue's `labelFontSize`
 * computed property to approximate rendered text width.
 *
 * @param nameLength - Number of characters in the state name.
 * @returns Estimated pixel width of the rendered label text.
 */
export function estimateNameLabelWidth(nameLength: number): number {
  let charWidth = 7;
  if (nameLength <= 2) charWidth = 10;
  else if (nameLength <= 4) charWidth = 8;
  return nameLength * charWidth;
}

/** Padding around the base circle (accounts for accept ring stroke). */
const CIRCLE_PADDING = 5;

/**
 * Compute the axis-aligned bounding box for a single state, including its
 * visual extras: accept ring padding, self-loop arc + label, and start arrow.
 */
export function computeStateBounds(info: StateVisualInfo): AABB {
  const r = STATE_RADIUS + CIRCLE_PADDING;
  const nameHalfWidth = info.nameLabelWidth / 2;
  const halfWidth = Math.max(r, nameHalfWidth);
  let minX = info.position.x - halfWidth;
  let maxX = info.position.x + halfWidth;
  let minY = info.position.y - r;
  let maxY = info.position.y + r;

  // Self-loop extends in the direction of its sector slot
  if (info.hasSelfLoop) {
    const sectorAngle = SECTOR_ANGLES[info.selfLoopSlot];
    const labelDistance = STATE_RADIUS + SELF_LOOP_RADIUS * 2 + 8;
    const labelHalfHeight = 10;

    const loopX = info.position.x + labelDistance * Math.cos(sectorAngle);
    const loopY = info.position.y + labelDistance * Math.sin(sectorAngle);

    const labelHalfWidth = (info.selfLoopLabelWidth * CHAR_WIDTH) / 2;
    if (loopX - labelHalfWidth < minX) minX = loopX - labelHalfWidth;
    if (loopX + labelHalfWidth > maxX) maxX = loopX + labelHalfWidth;
    if (loopY - labelHalfHeight < minY) minY = loopY - labelHalfHeight;
    if (loopY + labelHalfHeight > maxY) maxY = loopY + labelHalfHeight;
  }

  // Start arrow extends to the left
  if (info.isStart) {
    const arrowLeft = info.position.x - STATE_RADIUS - START_ARROW_LENGTH;
    if (arrowLeft < minX) minX = arrowLeft;
  }

  return { minX, minY, maxX, maxY };
}

/** Test whether two AABBs overlap (share interior area). */
export function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/** Expand an AABB outward by `amount` on every side. */
function inflateBounds(bounds: AABB, amount: number): AABB {
  return {
    minX: bounds.minX - amount,
    minY: bounds.minY - amount,
    maxX: bounds.maxX + amount,
    maxY: bounds.maxY + amount,
  };
}

/**
 * Compute the separation vector needed to push two overlapping AABBs apart.
 * Returns the axis ('x' | 'y') and a signed shift to apply to each position.
 * Positive shift means position[i] moves in the negative direction and
 * position[j] in the positive direction.
 */
function computeSeparation(
  a: AABB,
  b: AABB,
  posI: Position,
  posJ: Position,
): { axis: "x" | "y"; shiftI: number; shiftJ: number } {
  const overlapX = Math.min(a.maxX - b.minX, b.maxX - a.minX);
  const overlapY = Math.min(a.maxY - b.minY, b.maxY - a.minY);
  const half = (Math.min(overlapX, overlapY)) / 2;

  if (overlapX < overlapY) {
    const sign = posI.x < posJ.x ? -1 : 1;
    return { axis: "x", shiftI: sign * half, shiftJ: -sign * half };
  }
  const sign = posI.y < posJ.y ? -1 : 1;
  return { axis: "y", shiftI: sign * half, shiftJ: -sign * half };
}

/** Apply a separation vector to a pair of positions (mutates the array). */
function separatePair(
  positions: Position[],
  i: number,
  j: number,
  sep: { axis: "x" | "y"; shiftI: number; shiftJ: number },
): void {
  if (sep.axis === "x") {
    positions[i] = { ...positions[i], x: positions[i].x + sep.shiftI };
    positions[j] = { ...positions[j], x: positions[j].x + sep.shiftJ };
  }
  else {
    positions[i] = { ...positions[i], y: positions[i].y + sep.shiftI };
    positions[j] = { ...positions[j], y: positions[j].y + sep.shiftJ };
  }
}

/** Run one pass over all pairs, returning whether any overlap was resolved. */
function resolvePass(
  positions: Position[],
  visualInfos: StateVisualInfo[],
  padding: number,
): boolean {
  let anyOverlap = false;

  const bounds: AABB[] = visualInfos.map((info, i) =>
    computeStateBounds({ ...info, position: positions[i] }),
  );

  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const a = inflateBounds(bounds[i], padding);
      const b = inflateBounds(bounds[j], padding);

      if (!aabbOverlap(a, b)) continue;
      anyOverlap = true;

      const sep = computeSeparation(a, b, positions[i], positions[j]);
      separatePair(positions, i, j, sep);
    }
  }

  return anyOverlap;
}

/**
 * Iteratively resolve AABB overlaps by pushing colliding pairs apart along
 * the axis of minimum overlap.
 *
 * Mutates `positions` in place.
 *
 * @param positions    - State center positions (parallel to visualInfos).
 * @param visualInfos  - Visual info for each state.
 * @param maxIterations - Safety cap on resolution passes.
 * @param padding       - Extra gap (px) added to each AABB before overlap test.
 */
export function resolveCollisions(
  positions: Position[],
  visualInfos: StateVisualInfo[],
  maxIterations = 10,
  padding = 10,
): void {
  for (let iter = 0; iter < maxIterations; iter++) {
    if (!resolvePass(positions, visualInfos, padding)) break;
  }
}

/**
 * Build visual info array from store-shaped data (states + transitions).
 *
 * Used by relayout, SvgCanvas viewport watcher, and anywhere else that
 * needs to compute bounds from live store data.
 */
export function buildVisualInfosFromStore(
  states: AutomatonState[],
  transitions: Transition[],
  routeMap?: Map<string, TransitionRoute>,
): StateVisualInfo[] {
  // Pre-compute self-loop data: which states have self-loops, and the
  // combined label width (all symbols on that self-loop joined by ", ").
  const selfLoopInfo = new Map<string, { symbols: string[]; slot: number }>();
  for (const t of transitions) {
    if (t.sourceId === t.targetId) {
      const existing = selfLoopInfo.get(t.sourceId);
      if (existing) {
        existing.symbols.push(t.symbol);
      }
      else {
        const route = routeMap?.get(t.id);
        selfLoopInfo.set(t.sourceId, {
          symbols: [t.symbol],
          slot: route?.selfLoopSlot ?? 0,
        });
      }
    }
  }

  return states.map((s) => {
    const info = selfLoopInfo.get(s.id);
    const hasSelfLoop = info !== undefined;
    const labelText = hasSelfLoop ? info.symbols.join(", ") : "";
    return {
      position: s.position,
      hasSelfLoop,
      isStart: s.isStart,
      selfLoopLabelWidth: labelText.length,
      nameLabelWidth: estimateNameLabelWidth(s.name.length),
      selfLoopSlot: info?.slot ?? 0,
    };
  });
}

/**
 * Build visual info from tuple data (before store is patched).
 *
 * Determines self-loops by checking if transitions[name][symbol] includes
 * the state name itself.
 */
export function buildVisualInfosFromTuple(
  stateNames: string[],
  startState: string,
  tupleTransitions: Record<string, Record<string, string[]>>,
  positions: Position[],
): StateVisualInfo[] {
  return stateNames.map((name, i) => {
    const symbolMap = tupleTransitions[name] ?? {};
    const selfLoopSymbols: string[] = [];
    for (const [symbol, targets] of Object.entries(symbolMap)) {
      if (targets.includes(name)) {
        selfLoopSymbols.push(symbol);
      }
    }
    const hasSelfLoop = selfLoopSymbols.length > 0;
    const labelText = hasSelfLoop ? selfLoopSymbols.join(", ") : "";
    return {
      position: positions[i],
      hasSelfLoop,
      isStart: name === startState,
      selfLoopLabelWidth: labelText.length,
      nameLabelWidth: estimateNameLabelWidth(name.length),
      selfLoopSlot: 0,
    };
  });
}
