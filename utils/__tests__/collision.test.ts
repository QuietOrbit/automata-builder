import { describe, expect, it } from "vitest";
import {
  aabbOverlap,
  buildVisualInfosFromStore,
  buildVisualInfosFromTuple,
  computeStateBounds,
  estimateNameLabelWidth,
  resolveCollisions,
} from "../collision";
import type { AABB, StateVisualInfo } from "../collision";
import { STATE_RADIUS, START_ARROW_LENGTH } from "../geometry";

describe("utils/collision", () => {
  describe("computeStateBounds", () => {
    const CIRCLE_PADDING = 5;

    it("computes basic bounds for a plain state", () => {
      const info: StateVisualInfo = {
        position: { x: 100, y: 100 },
        hasSelfLoop: false,
        isStart: false,
        selfLoopLabelWidth: 0,
        nameLabelWidth: 0,
      };
      const bounds = computeStateBounds(info);
      const r = STATE_RADIUS + CIRCLE_PADDING;

      expect(bounds.minX).toBe(100 - r);
      expect(bounds.maxX).toBe(100 + r);
      expect(bounds.minY).toBe(100 - r);
      expect(bounds.maxY).toBe(100 + r);
    });

    it("extends left for start states", () => {
      const plain: StateVisualInfo = {
        position: { x: 100, y: 100 },
        hasSelfLoop: false,
        isStart: false,
        selfLoopLabelWidth: 0,
        nameLabelWidth: 0,
      };
      const start: StateVisualInfo = { ...plain, isStart: true };

      const plainBounds = computeStateBounds(plain);
      const startBounds = computeStateBounds(start);

      expect(startBounds.minX).toBeLessThan(plainBounds.minX);
      expect(startBounds.minX).toBe(100 - STATE_RADIUS - START_ARROW_LENGTH);
    });

    it("extends upward for self-loop states", () => {
      const plain: StateVisualInfo = {
        position: { x: 100, y: 100 },
        hasSelfLoop: false,
        isStart: false,
        selfLoopLabelWidth: 0,
        nameLabelWidth: 0,
      };
      const looped: StateVisualInfo = {
        ...plain,
        hasSelfLoop: true,
        selfLoopLabelWidth: 3,
      };

      const plainBounds = computeStateBounds(plain);
      const loopedBounds = computeStateBounds(looped);

      expect(loopedBounds.minY).toBeLessThan(plainBounds.minY);
    });

    it("extends horizontally for wide self-loop labels", () => {
      const narrow: StateVisualInfo = {
        position: { x: 100, y: 100 },
        hasSelfLoop: true,
        isStart: false,
        selfLoopLabelWidth: 1,
        nameLabelWidth: 0,
      };
      const wide: StateVisualInfo = { ...narrow, selfLoopLabelWidth: 20 };

      const narrowBounds = computeStateBounds(narrow);
      const wideBounds = computeStateBounds(wide);

      expect(wideBounds.maxX - wideBounds.minX).toBeGreaterThan(
        narrowBounds.maxX - narrowBounds.minX,
      );
    });

    it("extends horizontally for wide state name labels", () => {
      const short: StateVisualInfo = {
        position: { x: 100, y: 100 },
        hasSelfLoop: false,
        isStart: false,
        selfLoopLabelWidth: 0,
        nameLabelWidth: 20,
      };
      const wide: StateVisualInfo = { ...short, nameLabelWidth: 120 };

      const shortBounds = computeStateBounds(short);
      const wideBounds = computeStateBounds(wide);

      expect(wideBounds.maxX - wideBounds.minX).toBeGreaterThan(
        shortBounds.maxX - shortBounds.minX,
      );
      // Wide label should extend 60px each side from center
      expect(wideBounds.minX).toBe(100 - 60);
      expect(wideBounds.maxX).toBe(100 + 60);
    });
  });

  describe("aabbOverlap", () => {
    const box: AABB = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

    it("detects overlapping boxes", () => {
      expect(aabbOverlap(box, { minX: 5, minY: 5, maxX: 15, maxY: 15 })).toBe(true);
    });

    it("returns false for non-overlapping boxes", () => {
      expect(aabbOverlap(box, { minX: 20, minY: 20, maxX: 30, maxY: 30 })).toBe(false);
    });

    it("returns false for edge-touching boxes (no interior overlap)", () => {
      expect(aabbOverlap(box, { minX: 10, minY: 0, maxX: 20, maxY: 10 })).toBe(false);
    });

    it("detects containment as overlap", () => {
      expect(aabbOverlap(box, { minX: 2, minY: 2, maxX: 8, maxY: 8 })).toBe(true);
    });
  });

  describe("resolveCollisions", () => {
    it("does nothing when states do not overlap", () => {
      const positions = [
        { x: 0, y: 0 },
        { x: 500, y: 500 },
      ];
      const original = positions.map(p => ({ ...p }));
      const infos: StateVisualInfo[] = positions.map(p => ({
        position: p,
        hasSelfLoop: false,
        isStart: false,
        selfLoopLabelWidth: 0,
        nameLabelWidth: 0,
      }));

      resolveCollisions(positions, infos);

      expect(positions[0]).toEqual(original[0]);
      expect(positions[1]).toEqual(original[1]);
    });

    it("separates overlapping states", () => {
      const positions = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ];
      const infos: StateVisualInfo[] = positions.map(p => ({
        position: p,
        hasSelfLoop: false,
        isStart: false,
        selfLoopLabelWidth: 0,
        nameLabelWidth: 0,
      }));

      resolveCollisions(positions, infos);

      // After resolution, distance between centers should be greater
      const dx = positions[1].x - positions[0].x;
      expect(dx).toBeGreaterThan(10);
    });

    it("respects maxIterations cap", () => {
      // Two heavily overlapping states with maxIterations=1
      const positions = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ];
      const infos: StateVisualInfo[] = positions.map(p => ({
        position: p,
        hasSelfLoop: false,
        isStart: false,
        selfLoopLabelWidth: 0,
        nameLabelWidth: 0,
      }));

      // Should not throw, even if not fully resolved
      resolveCollisions(positions, infos, 1);
      expect(positions).toHaveLength(2);
    });
  });

  describe("buildVisualInfosFromStore", () => {
    it("builds visual info for states with no self-loops", () => {
      const states = [
        { id: "s1", name: "q0", position: { x: 0, y: 0 }, isStart: true, isAccept: false },
        { id: "s2", name: "q1", position: { x: 100, y: 0 }, isStart: false, isAccept: true },
      ];
      const transitions = [
        { id: "t1", sourceId: "s1", targetId: "s2", symbol: "a" },
      ];

      const infos = buildVisualInfosFromStore(states, transitions);

      expect(infos).toHaveLength(2);
      expect(infos[0].isStart).toBe(true);
      expect(infos[0].hasSelfLoop).toBe(false);
      expect(infos[1].isStart).toBe(false);
    });

    it("detects self-loops and computes label width", () => {
      const states = [
        { id: "s1", name: "q0", position: { x: 0, y: 0 }, isStart: true, isAccept: false },
      ];
      const transitions = [
        { id: "t1", sourceId: "s1", targetId: "s1", symbol: "a" },
        { id: "t2", sourceId: "s1", targetId: "s1", symbol: "b" },
      ];

      const infos = buildVisualInfosFromStore(states, transitions);

      expect(infos[0].hasSelfLoop).toBe(true);
      // "a, b" = 4 chars
      expect(infos[0].selfLoopLabelWidth).toBe(4);
    });
  });

  describe("buildVisualInfosFromTuple", () => {
    it("builds visual info from tuple data", () => {
      const names = ["q0", "q1"];
      const positions = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      const transitions = {
        q0: { a: ["q1"], b: ["q0"] },
        q1: { a: ["q1"] },
      };

      const infos = buildVisualInfosFromTuple(names, "q0", transitions, positions);

      expect(infos).toHaveLength(2);
      // q0 has self-loop via 'b'
      expect(infos[0].hasSelfLoop).toBe(true);
      expect(infos[0].isStart).toBe(true);
      // q1 has self-loop via 'a'
      expect(infos[1].hasSelfLoop).toBe(true);
      expect(infos[1].isStart).toBe(false);
    });

    it("handles states with no transitions", () => {
      const names = ["q0", "q1"];
      const positions = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      const transitions = {};

      const infos = buildVisualInfosFromTuple(names, "q0", transitions, positions);

      expect(infos[0].hasSelfLoop).toBe(false);
      expect(infos[1].hasSelfLoop).toBe(false);
    });

    it("includes nameLabelWidth based on name length", () => {
      const names = ["q0", "{q0,q1,q2}"];
      const positions = [{ x: 0, y: 0 }, { x: 200, y: 0 }];
      const transitions = {};

      const infos = buildVisualInfosFromTuple(names, "q0", transitions, positions);

      // Short name: 2 chars × 10px/char = 20px
      expect(infos[0].nameLabelWidth).toBe(20);
      // Long name: 10 chars × 7px/char = 70px
      expect(infos[1].nameLabelWidth).toBe(70);
    });
  });

  describe("estimateNameLabelWidth", () => {
    it("uses wider char width for short names", () => {
      // 2 chars × 10px = 20
      expect(estimateNameLabelWidth(2)).toBe(20);
    });

    it("uses medium char width for medium names", () => {
      // 4 chars × 8px = 32
      expect(estimateNameLabelWidth(4)).toBe(32);
    });

    it("uses narrower char width for long names", () => {
      // 10 chars × 7px = 70
      expect(estimateNameLabelWidth(10)).toBe(70);
    });
  });
});
