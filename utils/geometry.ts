import type {Position} from '~/types/automaton'

// --- Constants ---
export const STATE_RADIUS = 30
export const SELF_LOOP_RADIUS = 25
export const CURVE_OFFSET = 50
export const ARROWHEAD_SIZE = 10
export const LABEL_OFFSET = 15
export const START_ARROW_LENGTH = 45

// --- Vector operations ---

export function add(a: Position, b: Position): Position {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function subtract(a: Position, b: Position): Position {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function scale(v: Position, s: number): Position {
  return { x: v.x * s, y: v.y * s }
}

export function length(v: Position): number {
  return Math.hypot(v.x, v.y)
}

export function normalize(v: Position): Position {
  const len = length(v)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

export function perpendicular(v: Position): Position {
  // 90-degree rotation: (x, y) -> (-y, x) — NOSONAR: cross-assignment is intentional
  return { x: -v.y, y: v.x }
}

export function distance(from: Position, to: Position): number {
  return length(subtract(to, from))
}

export function midpoint(a: Position, b: Position): Position {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// --- Circle math ---

/** Point on circle boundary in a given direction from center */
export function circlePoint(center: Position, radius: number, direction: Position): Position {
  const dir = normalize(direction)
  return add(center, scale(dir, radius))
}

/** Point on circle boundary at a given angle (radians, 0 = right, CCW positive) */
export function circlePointAtAngle(center: Position, radius: number, angle: number): Position {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  }
}

// --- Bezier math ---

/** Point on quadratic bezier at parameter t */
export function quadraticBezierPoint(p0: Position, p1: Position, p2: Position, t: number): Position {
  const mt = 1 - t
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  }
}

// --- Transition path computation ---

export interface TransitionPath {
  path: string
  labelPosition: Position
  labelAngle: number
}

/** Compute SVG path for a self-loop arrow */
export function computeSelfLoopPath(center: Position, radius: number): TransitionPath {
  // Arc from upper-left to upper-right of the circle
  const angleLeft = -Math.PI / 2 - Math.PI / 6 // -120 degrees
  const angleRight = -Math.PI / 2 + Math.PI / 6 // -60 degrees

  const start = circlePointAtAngle(center, radius, angleLeft)
  const end = circlePointAtAngle(center, radius, angleRight)

  // Self-loop arc parameters
  const path = `M ${start.x} ${start.y} A ${SELF_LOOP_RADIUS} ${SELF_LOOP_RADIUS} 0 1 1 ${end.x} ${end.y}`

  const labelPosition = {
    x: center.x,
    y: center.y - radius - SELF_LOOP_RADIUS * 2 - 8,
  }

  return { path, labelPosition, labelAngle: 0 }
}

/** Compute SVG path for a straight arrow between two states */
export function computeStraightPath(
  source: Position,
  target: Position,
  radius: number,
): TransitionPath {
  const dir = subtract(target, source)
  const start = circlePoint(source, radius, dir)
  const negDir = scale(dir, -1)
  const end = circlePoint(target, radius, negDir)

  const path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`

  const mid = midpoint(start, end)
  const perp = normalize(perpendicular(normalize(dir)))
  const labelPosition = add(mid, scale(perp, LABEL_OFFSET))

  const labelAngle = Math.atan2(dir.y, dir.x) * (180 / Math.PI)

  return { path, labelPosition, labelAngle }
}

/** Compute SVG path for a curved arrow (used for bidirectional/parallel edges) */
export function computeCurvedPath(
  source: Position,
  target: Position,
  radius: number,
  curveDirection: 1 | -1,
  magnitude: number = 1,
): TransitionPath {
  const dir = normalize(subtract(target, source))
  const perp = perpendicular(dir)

  const mid = midpoint(source, target)
  const controlPoint = add(mid, scale(perp, CURVE_OFFSET * curveDirection * magnitude))

  // Compute start and end points on circle boundaries
  // Direction from source toward control point
  const startDir = normalize(subtract(controlPoint, source))
  const start = circlePoint(source, radius, startDir)

  // Direction from target toward control point
  const endDir = normalize(subtract(controlPoint, target))
  const end = circlePoint(target, radius, endDir)

  const path = `M ${start.x} ${start.y} Q ${controlPoint.x} ${controlPoint.y} ${end.x} ${end.y}`

  const labelPosition = quadraticBezierPoint(start, controlPoint, end, 0.5)
  const labelOffset = add(labelPosition, scale(scale(perp, curveDirection), LABEL_OFFSET * 0.5))

  const tangent = subtract(
    quadraticBezierPoint(start, controlPoint, end, 0.51),
    quadraticBezierPoint(start, controlPoint, end, 0.49),
  )
  const labelAngle = Math.atan2(tangent.y, tangent.x) * (180 / Math.PI)

  return { path: path, labelPosition: labelOffset, labelAngle }
}

/** Compute the start arrow path pointing to the start state */
export function computeStartArrowPath(stateCenter: Position, radius: number): string {
  const end = { x: stateCenter.x - radius, y: stateCenter.y }
  const start = { x: end.x - START_ARROW_LENGTH, y: end.y }
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
}
