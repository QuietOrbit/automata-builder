import { describe, expect, it } from "vitest";
import { buildEdgeList, initCirclePositions, runSimulation } from "../force-simulation";

describe("utils/force-simulation", () => {
  describe("initCirclePositions", () => {
    it("places nodes evenly on a circle", () => {
      const state = initCirclePositions([0, 1, 2, 3], 100, 4);

      // All nodes should be at radius ~100 from origin
      for (let i = 0; i < 4; i++) {
        const r = Math.hypot(state.posX[i], state.posY[i]);
        expect(r).toBeCloseTo(100, 0);
      }

      // Opposite nodes should be ~200 apart (diameter)
      const dist02 = Math.hypot(
        state.posX[0] - state.posX[2],
        state.posY[0] - state.posY[2],
      );
      expect(dist02).toBeCloseTo(200, 0);
    });

    it("respects totalSlots larger than node count", () => {
      const state = initCirclePositions([1, 3], 100, 5);

      expect(state.posX.length).toBe(5);
      // Nodes 0, 2, 4 should be at origin (uninitialized)
      expect(state.posX[0]).toBe(0);
      expect(state.posY[0]).toBe(0);
      // Nodes 1 and 3 should be placed
      const r1 = Math.hypot(state.posX[1], state.posY[1]);
      expect(r1).toBeCloseTo(100, 0);
    });
  });

  describe("buildEdgeList", () => {
    it("deduplicates bidirectional edges", () => {
      // 0 ↔ 1 should produce one edge with weight 1.5
      const adj = [new Set([1]), new Set([0])];
      const edges = buildEdgeList([0, 1], adj);

      expect(edges).toHaveLength(1);
      expect(edges[0].weight).toBe(1.5);
    });

    it("assigns weight 1 to unidirectional edges", () => {
      // 0 → 1 only
      const adj = [new Set([1]), new Set<number>()];
      const edges = buildEdgeList([0, 1], adj);

      expect(edges).toHaveLength(1);
      expect(edges[0].weight).toBe(1);
    });

    it("excludes self-loops", () => {
      const adj = [new Set([0, 1]), new Set<number>()];
      const edges = buildEdgeList([0, 1], adj);

      expect(edges).toHaveLength(1);
      expect(edges[0].a).not.toBe(edges[0].b);
    });

    it("excludes edges to nodes outside the node set", () => {
      // 0 → 1, 0 → 2, but only nodes [0, 1] are in the simulation
      const adj = [new Set([1, 2]), new Set<number>(), new Set<number>()];
      const edges = buildEdgeList([0, 1], adj);

      expect(edges).toHaveLength(1);
    });
  });

  describe("runSimulation", () => {
    it("pushes apart nodes with only repulsion (no edges)", () => {
      // Two nodes close together, no edges — should repel apart
      const state = initCirclePositions([0, 1], 10, 2);
      const initialDist = Math.hypot(
        state.posX[0] - state.posX[1],
        state.posY[0] - state.posY[1],
      );
      runSimulation(state, [0, 1], [], 100);

      const finalDist = Math.hypot(
        state.posX[0] - state.posX[1],
        state.posY[0] - state.posY[1],
      );
      expect(finalDist).toBeGreaterThan(initialDist);
    });

    it("pulls connected nodes closer than unconnected", () => {
      // 3 nodes: 0-1 connected, 0-2 unconnected
      const state = initCirclePositions([0, 1, 2], 150, 3);
      const edges = [{ a: 0, b: 1, weight: 1 }];
      runSimulation(state, [0, 1, 2], edges, 150);

      const dist01 = Math.hypot(
        state.posX[0] - state.posX[1],
        state.posY[0] - state.posY[1],
      );
      const dist02 = Math.hypot(
        state.posX[0] - state.posX[2],
        state.posY[0] - state.posY[2],
      );
      expect(dist01).toBeLessThan(dist02);
    });
  });
});
