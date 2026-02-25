import { describe, expect, it } from "vitest";
import {
  add,
  subtract,
  scale,
  length,
  normalize,
  perpendicular,
  distance,
  midpoint,
  circlePoint,
  circlePointAtAngle,
  quadraticBezierPoint,
  computeSelfLoopPath,
  computeStraightPath,
  computeCurvedPath,
  computeStartArrowPath,
  STATE_RADIUS,
  START_ARROW_LENGTH,
  LABEL_OFFSET,
} from "../geometry";
import type { Position } from "~/types/automaton";

/** Helper: assert two positions are close within floating-point tolerance. */
function expectPosition(actual: Position, expected: Position, precision = 6) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
}

describe("utils/geometry", () => {
  // --- Vector operations ---

  describe("add", () => {
    it("adds two vectors component-wise", () => {
      expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    });

    it("handles negative values", () => {
      expect(add({ x: -5, y: 3 }, { x: 2, y: -7 })).toEqual({ x: -3, y: -4 });
    });

    it("identity with zero vector", () => {
      expect(add({ x: 5, y: 10 }, { x: 0, y: 0 })).toEqual({ x: 5, y: 10 });
    });
  });

  describe("subtract", () => {
    it("subtracts b from a component-wise", () => {
      expect(subtract({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
    });

    it("returns zero for identical vectors", () => {
      expect(subtract({ x: 3, y: 4 }, { x: 3, y: 4 })).toEqual({ x: 0, y: 0 });
    });
  });

  describe("scale", () => {
    it("scales a vector by a positive scalar", () => {
      expect(scale({ x: 2, y: 3 }, 4)).toEqual({ x: 8, y: 12 });
    });

    it("scales by zero returns zero vector", () => {
      expect(scale({ x: 5, y: 10 }, 0)).toEqual({ x: 0, y: 0 });
    });

    it("scales by negative scalar", () => {
      expect(scale({ x: 2, y: -3 }, -2)).toEqual({ x: -4, y: 6 });
    });
  });

  describe("length", () => {
    it("returns 5 for a 3-4-5 triangle", () => {
      expect(length({ x: 3, y: 4 })).toBe(5);
    });

    it("returns 0 for zero vector", () => {
      expect(length({ x: 0, y: 0 })).toBe(0);
    });

    it("returns absolute value for axis-aligned vectors", () => {
      expect(length({ x: -7, y: 0 })).toBe(7);
    });
  });

  describe("normalize", () => {
    it("returns unit vector in same direction", () => {
      const result = normalize({ x: 3, y: 4 });
      expectPosition(result, { x: 0.6, y: 0.8 });
    });

    it("returns zero vector for zero input", () => {
      expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    });

    it("has length 1 for non-zero input", () => {
      const result = normalize({ x: 10, y: -5 });
      expect(length(result)).toBeCloseTo(1);
    });
  });

  describe("perpendicular", () => {
    it("rotates 90 degrees counter-clockwise", () => {
      expectPosition(perpendicular({ x: 1, y: 0 }), { x: 0, y: 1 });
    });

    it("produces orthogonal vector (dot product = 0)", () => {
      const v = { x: 3, y: 7 };
      const p = perpendicular(v);
      const dot = v.x * p.x + v.y * p.y;
      expect(dot).toBe(0);
    });

    it("preserves length", () => {
      const v = { x: 3, y: 4 };
      expect(length(perpendicular(v))).toBe(length(v));
    });
  });

  describe("distance", () => {
    it("returns distance between two points", () => {
      expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    it("returns 0 for same point", () => {
      expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    });

    it("is commutative", () => {
      const a = { x: 1, y: 2 };
      const b = { x: 4, y: 6 };
      expect(distance(a, b)).toBe(distance(b, a));
    });
  });

  describe("midpoint", () => {
    it("returns center between two points", () => {
      expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 10 })).toEqual({ x: 5, y: 5 });
    });

    it("returns same point when both inputs are identical", () => {
      expect(midpoint({ x: 7, y: 3 }, { x: 7, y: 3 })).toEqual({ x: 7, y: 3 });
    });
  });

  // --- Circle math ---

  describe("circlePoint", () => {
    it("returns point on circle boundary in given direction", () => {
      const center = { x: 100, y: 100 };
      const result = circlePoint(center, 30, { x: 1, y: 0 });
      expectPosition(result, { x: 130, y: 100 });
    });

    it("normalizes non-unit direction vectors", () => {
      const center = { x: 0, y: 0 };
      const result = circlePoint(center, 10, { x: 100, y: 0 });
      expectPosition(result, { x: 10, y: 0 });
    });
  });

  describe("circlePointAtAngle", () => {
    it("returns point at 0 radians (right)", () => {
      const result = circlePointAtAngle({ x: 0, y: 0 }, 10, 0);
      expectPosition(result, { x: 10, y: 0 });
    });

    it("returns point at PI/2 radians (down in SVG coords)", () => {
      const result = circlePointAtAngle({ x: 0, y: 0 }, 10, Math.PI / 2);
      expectPosition(result, { x: 0, y: 10 });
    });

    it("offsets from center correctly", () => {
      const result = circlePointAtAngle({ x: 50, y: 50 }, 10, 0);
      expectPosition(result, { x: 60, y: 50 });
    });
  });

  // --- Bezier math ---

  describe("quadraticBezierPoint", () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 50, y: 100 };
    const p2 = { x: 100, y: 0 };

    it("returns start point at t=0", () => {
      expectPosition(quadraticBezierPoint(p0, p1, p2, 0), p0);
    });

    it("returns end point at t=1", () => {
      expectPosition(quadraticBezierPoint(p0, p1, p2, 1), p2);
    });

    it("returns midpoint-ish at t=0.5", () => {
      const mid = quadraticBezierPoint(p0, p1, p2, 0.5);
      expect(mid.x).toBeCloseTo(50);
      expect(mid.y).toBeCloseTo(50);
    });
  });

  // --- Path computation ---

  describe("computeSelfLoopPath", () => {
    const center = { x: 200, y: 200 };
    const result = computeSelfLoopPath(center, STATE_RADIUS);

    it("returns an SVG path starting with M", () => {
      expect(result.path).toMatch(/^M /);
    });

    it("contains an arc command", () => {
      expect(result.path).toContain("A ");
    });

    it("contains a line segment for arrowhead alignment", () => {
      expect(result.path).toContain("L ");
    });

    it("positions label above the state", () => {
      expect(result.labelPosition.y).toBeLessThan(center.y - STATE_RADIUS);
      expect(result.labelPosition.x).toBe(center.x);
    });

    it("has zero label angle for self-loops", () => {
      expect(result.labelAngle).toBe(0);
    });
  });

  describe("computeStraightPath", () => {
    const source = { x: 0, y: 0 };
    const target = { x: 200, y: 0 };
    const result = computeStraightPath(source, target, STATE_RADIUS);

    it("returns an SVG path with M and L commands", () => {
      expect(result.path).toMatch(/^M .+ L .+$/);
    });

    it("starts at source circle boundary, not center", () => {
      const pathCoords = result.path.match(/^M ([\d.-]+) ([\d.-]+)/);
      expect(pathCoords).not.toBeNull();
      const startX = Number.parseFloat(pathCoords![1]);
      expect(startX).toBeCloseTo(STATE_RADIUS, 0);
    });

    it("ends at target circle boundary, not center", () => {
      const pathCoords = result.path.match(/L ([\d.-]+) ([\d.-]+)$/);
      expect(pathCoords).not.toBeNull();
      const endX = Number.parseFloat(pathCoords![1]);
      expect(endX).toBeCloseTo(200 - STATE_RADIUS, 0);
    });

    it("places label offset perpendicular to the arrow", () => {
      // For a horizontal arrow, label should be offset vertically
      const mid = midpoint(source, target);
      expect(result.labelPosition.x).toBeCloseTo(mid.x, 0);
      expect(Math.abs(result.labelPosition.y)).toBeCloseTo(LABEL_OFFSET, 0);
    });
  });

  describe("computeCurvedPath", () => {
    const source = { x: 0, y: 0 };
    const target = { x: 200, y: 0 };

    it("returns an SVG path with M and Q commands", () => {
      const result = computeCurvedPath(source, target, STATE_RADIUS, 1);
      expect(result.path).toMatch(/^M .+ Q .+$/);
    });

    it("curves in opposite directions for +1 and -1", () => {
      const up = computeCurvedPath(source, target, STATE_RADIUS, 1);
      const down = computeCurvedPath(source, target, STATE_RADIUS, -1);
      // Control points should be on opposite sides
      expect(up.labelPosition.y).not.toBeCloseTo(down.labelPosition.y, 0);
    });

    it("respects magnitude parameter", () => {
      const normal = computeCurvedPath(source, target, STATE_RADIUS, 1, 1);
      const doubled = computeCurvedPath(source, target, STATE_RADIUS, 1, 2);
      // Doubled magnitude should produce a label further from the midline
      expect(Math.abs(doubled.labelPosition.y)).toBeGreaterThan(
        Math.abs(normal.labelPosition.y),
      );
    });
  });

  describe("computeStartArrowPath", () => {
    const center = { x: 200, y: 100 };
    const result = computeStartArrowPath(center, STATE_RADIUS);

    it("returns an SVG path with M and L commands", () => {
      expect(result).toMatch(/^M .+ L .+$/);
    });

    it("ends at the left edge of the state circle", () => {
      const pathCoords = result.match(/L ([\d.-]+) ([\d.-]+)$/);
      expect(pathCoords).not.toBeNull();
      expect(Number.parseFloat(pathCoords![1])).toBeCloseTo(center.x - STATE_RADIUS);
      expect(Number.parseFloat(pathCoords![2])).toBeCloseTo(center.y);
    });

    it("starts START_ARROW_LENGTH pixels to the left of the circle edge", () => {
      const pathCoords = result.match(/^M ([\d.-]+) ([\d.-]+)/);
      expect(pathCoords).not.toBeNull();
      const expectedX = center.x - STATE_RADIUS - START_ARROW_LENGTH;
      expect(Number.parseFloat(pathCoords![1])).toBeCloseTo(expectedX);
    });

    it("is horizontal (same y for start and end)", () => {
      const coords = result.match(/([\d.-]+) ([\d.-]+)/g);
      expect(coords).toHaveLength(2);
      const startY = coords![0].split(" ")[1];
      const endY = coords![1].split(" ")[1];
      expect(startY).toBe(endY);
    });
  });
});
