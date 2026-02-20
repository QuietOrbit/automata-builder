import type {Position} from '~/types/automaton'

/** Radius of a state node circle in SVG units. */
export const STATE_RADIUS = 30

/** Radius of the self-loop arc drawn above a state. */
export const SELF_LOOP_RADIUS = 25

/** Perpendicular offset for curved (bidirectional) transition arrows. */
export const CURVE_OFFSET = 50

/** Size of the triangular arrowhead marker in SVG units. */
export const ARROWHEAD_SIZE = 10

/** Perpendicular offset for positioning transition labels away from the arrow path. */
export const LABEL_OFFSET = 15

/** Length of the horizontal arrow that points to the start state. */
export const START_ARROW_LENGTH = 45

// --- Vector operations ---

/** Add two vectors component-wise. */
export function add(a: Position, b: Position): Position {
  return { x: a.x + b.x, y: a.y + b.y }
}

/** Subtract vector `b` from vector `a` component-wise. */
export function subtract(a: Position, b: Position): Position {
  return { x: a.x - b.x, y: a.y - b.y }
}

/**
 * Scale a vector by a scalar multiplier.
 * @param v - The vector to scale.
 * @param s - The scalar multiplier.
 */
export function scale(v: Position, s: number): Position {
  return { x: v.x * s, y: v.y * s }
}

/** Compute the Euclidean length (magnitude) of a vector. */
export function length(v: Position): number {
  return Math.hypot(v.x, v.y)
}

/** Return a unit vector in the same direction, or (0,0) for zero-length vectors. */
export function normalize(v: Position): Position {
  const len = length(v)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

/** Rotate a vector 90 degrees counter-clockwise: (x, y) becomes (-y, x). */
export function perpendicular(v: Position): Position {
  // cross-assignment is intentional
  return { x: -v.y, y: v.x }
}

/** Compute the Euclidean distance between two points. */
export function distance(from: Position, to: Position): number {
  return length(subtract(to, from))
}

/** Compute the midpoint between two positions. */
export function midpoint(a: Position, b: Position): Position {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// --- Circle math ---

/**
 * Find the point on a circle's boundary in a given direction from its center.
 * @param center - Center of the circle.
 * @param radius - Radius of the circle.
 * @param direction - Direction vector (does not need to be normalized).
 */
export function circlePoint(center: Position, radius: number, direction: Position): Position {
  const dir = normalize(direction)
  return add(center, scale(dir, radius))
}

/**
 * Find the point on a circle's boundary at a given angle.
 * @param center - Center of the circle.
 * @param radius - Radius of the circle.
 * @param angle - Angle in radians (0 = right, counter-clockwise positive).
 */
export function circlePointAtAngle(center: Position, radius: number, angle: number): Position {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  }
}

// --- Bezier math ---

/**
 * Evaluate a point on a quadratic Bezier curve at parameter t.
 * @param p0 - Start point.
 * @param p1 - Control point.
 * @param p2 - End point.
 * @param t - Parameter in [0, 1].
 */
export function quadraticBezierPoint(p0: Position, p1: Position, p2: Position, t: number): Position {
  const mt = 1 - t
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  }
}

// --- Transition path computation ---

/** Computed SVG path data and label positioning for a transition arrow. */
export interface TransitionPath {
  /** SVG path `d` attribute string. */
  path: string
  /** Canvas position where the transition label should be rendered. */
  labelPosition: Position
  /** Angle in degrees for aligning the label with the arrow direction. */
  labelAngle: number
}

/**
 * Compute the SVG path for a self-loop arc above a state node.
 * The arc runs from the upper-left to upper-right of the circle boundary.
 * @param center - Center position of the state.
 * @param radius - Radius of the state circle.
 */
export function computeSelfLoopPath(center: Position, radius: number): TransitionPath {
  const angleLeft = -Math.PI / 2 - Math.PI / 6 // -120 degrees
  const angleRight = -Math.PI / 2 + Math.PI / 6 // -60 degrees

  const start = circlePointAtAngle(center, radius, angleLeft)
  const end = circlePointAtAngle(center, radius, angleRight)

  const path = `M ${start.x} ${start.y} A ${SELF_LOOP_RADIUS} ${SELF_LOOP_RADIUS} 0 1 1 ${end.x} ${end.y}`

  const labelPosition = {
    x: center.x,
    y: center.y - radius - SELF_LOOP_RADIUS * 2 - 8,
  }

  return { path, labelPosition, labelAngle: 0 }
}

/**
 * Compute the SVG path for a straight arrow between two state nodes.
 * Endpoints are placed on the circle boundaries, not at the centers.
 * @param source - Center position of the source state.
 * @param target - Center position of the target state.
 * @param radius - Radius of the state circles (assumed equal).
 */
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

/**
 * Compute the SVG path for a curved (quadratic Bezier) arrow.
 * Used for bidirectional edges so opposing arrows don't overlap.
 * @param source - Center position of the source state.
 * @param target - Center position of the target state.
 * @param radius - Radius of the state circles.
 * @param curveDirection - Which side to curve toward: 1 or -1.
 * @param magnitude - Multiplier for the curve offset (default 1).
 */
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

  // Direction from source/target toward control point for circle boundary intersection
  const startDir = normalize(subtract(controlPoint, source))
  const start = circlePoint(source, radius, startDir)

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

/**
 * Compute the SVG path for the start-state indicator arrow.
 * Draws a horizontal line ending at the left edge of the state circle.
 * @param stateCenter - Center position of the start state.
 * @param radius - Radius of the state circle.
 */
export function computeStartArrowPath(stateCenter: Position, radius: number): string {
  const end = { x: stateCenter.x - radius, y: stateCenter.y }
  const start = { x: end.x - START_ARROW_LENGTH, y: end.y }
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
}
