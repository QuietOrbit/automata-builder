import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";
import type { LayoutTransition } from "./layout";

describe("utils/layout", () => {
  describe("computeLayout", () => {
    it("returns positions array matching state count", () => {
      const positions = computeLayout(3, 0, [
        { sourceIndex: 0, targetIndex: 1 },
        { sourceIndex: 1, targetIndex: 2 },
      ]);
      expect(positions).toHaveLength(3);
    });

    describe("chain topology", () => {
      it("lays out a simple chain left-to-right along y=0", () => {
        // 0 → 1 → 2 (pure chain, no back-edges)
        const positions = computeLayout(3, 0, [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 1, targetIndex: 2 },
        ]);

        // All on y=0
        for (const pos of positions) {
          expect(pos.y).toBe(0);
        }

        // Left-to-right ordering: x[0] < x[1] < x[2]
        expect(positions[0].x).toBeLessThan(positions[1].x);
        expect(positions[1].x).toBeLessThan(positions[2].x);
      });

      it("centers the chain around x=0", () => {
        const positions = computeLayout(3, 0, [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 1, targetIndex: 2 },
        ]);
        // Middle state should be at x=0
        expect(positions[1].x).toBe(0);
      });
    });

    describe("layered topology", () => {
      it("lays out states in columns when a layer has multiple states", () => {
        // 0 → 1, 0 → 2 (layer 0: [0], layer 1: [1, 2])
        const positions = computeLayout(3, 0, [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 0, targetIndex: 2 },
        ]);

        // State 0 should be to the left of states 1 and 2
        expect(positions[0].x).toBeLessThan(positions[1].x);
        expect(positions[0].x).toBeLessThan(positions[2].x);

        // States 1 and 2 should be in the same column (same x)
        expect(positions[1].x).toBe(positions[2].x);

        // States 1 and 2 should be at different y positions
        expect(positions[1].y).not.toBe(positions[2].y);
      });
    });

    describe("dense/circular topology", () => {
      it("uses circular layout for a fully-connected graph", () => {
        // All states one hop from start → dense
        const transitions: LayoutTransition[] = [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 0, targetIndex: 2 },
          { sourceIndex: 0, targetIndex: 3 },
          { sourceIndex: 1, targetIndex: 0 },
          { sourceIndex: 2, targetIndex: 0 },
          { sourceIndex: 3, targetIndex: 0 },
        ];
        const positions = computeLayout(4, 0, transitions);

        // All states should have positions
        for (const pos of positions) {
          expect(pos).toBeDefined();
          expect(pos.x).toBeDefined();
          expect(pos.y).toBeDefined();
        }

        // Not all on the same line (would be chain)
        const uniqueYs = new Set(positions.map(p => p.y));
        expect(uniqueYs.size).toBeGreaterThan(1);
      });

      it("uses circular layout for chain with back-edges", () => {
        // 0 → 1 → 2 → 0 (cycle — back-edge makes it dense)
        const positions = computeLayout(3, 0, [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 1, targetIndex: 2 },
          { sourceIndex: 2, targetIndex: 0 },
        ]);

        // Not a straight line — should have varied y values
        const uniqueYs = new Set(positions.map(p => p.y));
        expect(uniqueYs.size).toBeGreaterThan(1);
      });
    });

    describe("unreachable states", () => {
      it("positions unreachable states below the main layout", () => {
        // 0 → 1, state 2 is unreachable
        const positions = computeLayout(3, 0, [
          { sourceIndex: 0, targetIndex: 1 },
        ]);

        // State 2 should be below states 0 and 1
        const maxReachableY = Math.max(positions[0].y, positions[1].y);
        expect(positions[2].y).toBeGreaterThan(maxReachableY);
      });

      it("lays out multiple unreachable states in a row", () => {
        // 0 → 1, states 2 and 3 unreachable
        const positions = computeLayout(4, 0, [
          { sourceIndex: 0, targetIndex: 1 },
        ]);

        // Both unreachable states at same y
        expect(positions[2].y).toBe(positions[3].y);

        // Different x positions
        expect(positions[2].x).not.toBe(positions[3].x);
      });
    });

    describe("crossing minimization", () => {
      it("reorders nodes within layers to reduce crossings", () => {
        // Graph: 0→1, 0→2, 0→3, 1→5, 3→4
        // BFS: layer 0=[0], layer 1=[1,2,3], layer 2=[4,5]
        // Without reorder: edges 1→5 and 3→4 cross (1 at top, 5 at bottom)
        // After reorder: layer 2 becomes [5,4], no crossing
        const transitions: LayoutTransition[] = [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 0, targetIndex: 2 },
          { sourceIndex: 0, targetIndex: 3 },
          { sourceIndex: 3, targetIndex: 4 },
          { sourceIndex: 1, targetIndex: 5 },
        ];
        const positions = computeLayout(6, 0, transitions);

        // States 1-3 should be in the same column (layer 1)
        expect(positions[1].x).toBe(positions[2].x);
        expect(positions[2].x).toBe(positions[3].x);

        // States 4-5 should be in the same column (layer 2)
        expect(positions[4].x).toBe(positions[5].x);

        // After crossing minimization, state 5 (connected to state 1 at top)
        // should be above state 4 (connected to state 3 at bottom)
        expect(positions[5].y).toBeLessThan(positions[4].y);
      });
    });

    describe("edge cases", () => {
      it("handles a single state with no transitions", () => {
        const positions = computeLayout(1, 0, []);
        expect(positions).toHaveLength(1);
        expect(positions[0]).toBeDefined();
      });

      it("handles self-loops without affecting layout classification", () => {
        // 0 → 1 → 2 with self-loop on 1 — still a chain
        const positions = computeLayout(3, 0, [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 1, targetIndex: 1 },
          { sourceIndex: 1, targetIndex: 2 },
        ]);

        // Should still be chain layout (all y=0)
        for (const pos of positions) {
          expect(pos.y).toBe(0);
        }
      });
    });
  });
});
