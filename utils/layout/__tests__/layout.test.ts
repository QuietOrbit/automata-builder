import { describe, expect, it } from "vitest";
import { computeLayout, findDominantPath, isChainLike, layoutChainWithOffPath, layoutForceDirected, rotateStartLeft, scaleToTargetSpacing } from "..";
import type { LayoutTransition } from "..";

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

    describe("chain with back-edges", () => {
      it("uses chain layout for a cycle with dominant forward path", () => {
        // 0 → 1 → 2, 2 → 0 — path 0→1→2 covers 100%
        const positions = computeLayout(3, 0, [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 1, targetIndex: 2 },
          { sourceIndex: 2, targetIndex: 0 },
        ]);

        // Should be chain: all y=0, left-to-right
        for (const pos of positions) {
          expect(pos.y).toBe(0);
        }
        expect(positions[0].x).toBeLessThan(positions[1].x);
        expect(positions[1].x).toBeLessThan(positions[2].x);
      });
    });

    describe("force-directed layout", () => {
      it("lays out a fully-connected graph with non-overlapping positions", () => {
        const transitions: LayoutTransition[] = [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 0, targetIndex: 2 },
          { sourceIndex: 0, targetIndex: 3 },
          { sourceIndex: 1, targetIndex: 0 },
          { sourceIndex: 1, targetIndex: 3 },
          { sourceIndex: 2, targetIndex: 0 },
          { sourceIndex: 2, targetIndex: 3 },
          { sourceIndex: 3, targetIndex: 1 },
          { sourceIndex: 3, targetIndex: 2 },
        ];
        const positions = computeLayout(4, 0, transitions);

        for (const pos of positions) {
          expect(pos).toBeDefined();
        }
        // No two states overlap
        for (let i = 0; i < 4; i++) {
          for (let j = i + 1; j < 4; j++) {
            const dist = Math.hypot(
              positions[i].x - positions[j].x,
              positions[i].y - positions[j].y,
            );
            expect(dist).toBeGreaterThan(20);
          }
        }
      });

      it("produces integer positions for force-directed graphs", () => {
        // Star graph — no dominant path, triggers force-directed
        const transitions: LayoutTransition[] = [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 0, targetIndex: 2 },
          { sourceIndex: 0, targetIndex: 3 },
          { sourceIndex: 0, targetIndex: 4 },
          { sourceIndex: 1, targetIndex: 0 },
          { sourceIndex: 2, targetIndex: 0 },
          { sourceIndex: 3, targetIndex: 0 },
          { sourceIndex: 4, targetIndex: 0 },
        ];
        const positions = computeLayout(5, 0, transitions);

        for (const pos of positions) {
          expect(Number.isInteger(pos.x)).toBe(true);
          expect(Number.isInteger(pos.y)).toBe(true);
        }
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

  describe("findDominantPath", () => {
    it("finds a chain path covering all states", () => {
      // 0 → 1 → 2 → 3 (pure chain)
      const adj = [new Set([1]), new Set([2]), new Set([3]), new Set<number>()];
      const path = findDominantPath(0, adj, 4);
      expect(path).toEqual([0, 1, 2, 3]);
    });

    it("finds path through a diamond graph", () => {
      // 0 → 1, 0 → 2, 1 → 3, 2 → 3 (diamond — longest path 0→1→3 or 0→2→3 = 3/4 = 75%)
      const adj = [new Set([1, 2]), new Set([3]), new Set([3]), new Set<number>()];
      const path = findDominantPath(0, adj, 4);
      expect(path).not.toBeNull();
      expect(path!.length).toBeGreaterThanOrEqual(3);
    });

    it("returns null when path covers less than 60%", () => {
      // Star: 0 → 1, 0 → 2, 0 → 3, 0 → 4 (longest path from 0 is 2 states = 40%)
      const adj = [
        new Set([1, 2, 3, 4]),
        new Set<number>(),
        new Set<number>(),
        new Set<number>(),
        new Set<number>(),
      ];
      const path = findDominantPath(0, adj, 5);
      expect(path).toBeNull();
    });

    it("finds chain with back-edges", () => {
      // 0 → 1 → 2, 2 → 0 (chain with back-edge)
      const adj = [new Set([1]), new Set([2]), new Set([0])];
      const path = findDominantPath(0, adj, 3);
      expect(path).toEqual([0, 1, 2]);
    });

    it("handles single state", () => {
      const adj = [new Set<number>()];
      const path = findDominantPath(0, adj, 1);
      expect(path).toEqual([0]);
    });

    it("returns null for fully symmetric graph with short paths", () => {
      // Complete graph K4 with bidirectional edges but many short paths
      // 0 ↔ 1, 0 ↔ 2, 0 ↔ 3, 1 ↔ 2, 1 ↔ 3, 2 ↔ 3
      const adj = [
        new Set([1, 2, 3]),
        new Set([0, 2, 3]),
        new Set([0, 1, 3]),
        new Set([0, 1, 2]),
      ];
      const path = findDominantPath(0, adj, 4);
      // K4 has a Hamiltonian path: 0→1→2→3 = 4/4 = 100%, so it WILL find one
      expect(path).not.toBeNull();
      expect(path!.length).toBe(4);
    });
  });

  describe("isChainLike", () => {
    it("returns true for a pure forward chain", () => {
      // 0 → 1 → 2 → 3 — no cross-path edges
      const adj = [new Set([1]), new Set([2]), new Set([3]), new Set<number>()];
      expect(isChainLike([0, 1, 2, 3], adj)).toBe(true);
    });

    it("returns true for a chain with a single back-edge", () => {
      // 0 → 1 → 2, 2 → 0 — one cross-edge (distance 2), ratio 1/3 = 0.33
      const adj = [new Set([1]), new Set([2]), new Set([0])];
      expect(isChainLike([0, 1, 2], adj)).toBe(true);
    });

    it("returns false for a 2x2 grid (even 0s and 1s pattern)", () => {
      // Path [0,1,3,2] but q0↔q2 skip from position 0 to 3
      const adj = [
        new Set([1, 2]),
        new Set([0, 3]),
        new Set([3, 0]),
        new Set([2, 1]),
      ];
      expect(isChainLike([0, 1, 3, 2], adj)).toBe(false);
    });

    it("returns false for a complete graph K4", () => {
      const adj = [
        new Set([1, 2, 3]),
        new Set([0, 2, 3]),
        new Set([0, 1, 3]),
        new Set([0, 1, 2]),
      ];
      // Any Hamiltonian path has many cross-edges
      expect(isChainLike([0, 1, 2, 3], adj)).toBe(false);
    });

    it("returns true for 2-node path", () => {
      const adj = [new Set([1]), new Set([0])];
      expect(isChainLike([0, 1], adj)).toBe(true);
    });
  });

  describe("layoutChainWithOffPath", () => {
    it("places path states horizontally on y=0", () => {
      // Path: 0 → 1 → 2, no off-path
      const adj = [new Set([1]), new Set([2]), new Set<number>()];
      const out: { x: number; y: number }[] = new Array(3);
      layoutChainWithOffPath([0, 1, 2], [], adj, 150, 120, out);

      for (const pos of out) {
        expect(pos.y).toBe(0);
      }
      // Left-to-right ordering
      expect(out[0].x).toBeLessThan(out[1].x);
      expect(out[1].x).toBeLessThan(out[2].x);
    });

    it("centers path around x=0", () => {
      const adj = [new Set([1]), new Set([2]), new Set<number>()];
      const out: { x: number; y: number }[] = new Array(3);
      layoutChainWithOffPath([0, 1, 2], [], adj, 150, 120, out);

      // Middle state at x=0
      expect(out[1].x).toBe(0);
    });

    it("places off-path state near its most-connected path neighbor", () => {
      // Path: 0 → 1, off-path: 2 connected to state 1 (both directions)
      const adj = [new Set([1]), new Set([2]), new Set([1])];
      const out: { x: number; y: number }[] = new Array(3);
      layoutChainWithOffPath([0, 1], [2], adj, 150, 120, out);

      // Off-path state 2 should be at a different y (above or below chain)
      expect(out[2].y).not.toBe(0);
      // Off-path state should be near state 1's x position
      expect(out[2].x).toBe(out[1].x);
    });

    it("places off-path state near the path neighbor with most connections", () => {
      // Path: 0 → 1 → 2, off-path: 3 connected to state 0 (1 edge) and state 2 (2 edges)
      const adj = [
        new Set([1, 3]),
        new Set([2]),
        new Set([3]),
        new Set([2]),
      ];
      const out: { x: number; y: number }[] = new Array(4);
      layoutChainWithOffPath([0, 1, 2], [3], adj, 150, 120, out);

      // State 3 has 2 connections to state 2 (3→2 and 2→3) vs 1 to state 0 (0→3)
      // So it should be placed near state 2's x
      expect(out[3].x).toBe(out[2].x);
    });

    it("alternates off-path states above and below when sharing a neighbor", () => {
      // Path: 0 → 1, off-path: 2 and 3 both connected to state 1
      const adj = [
        new Set([1]),
        new Set([2, 3]),
        new Set<number>(),
        new Set<number>(),
      ];
      const out: { x: number; y: number }[] = new Array(4);
      layoutChainWithOffPath([0, 1], [2, 3], adj, 150, 120, out);

      // Both off-path, both non-zero y
      expect(out[2].y).not.toBe(0);
      expect(out[3].y).not.toBe(0);
      // Opposite sides of the chain
      expect(Math.sign(out[2].y)).not.toBe(Math.sign(out[3].y));
    });
  });

  describe("layoutForceDirected", () => {
    it("produces non-overlapping positions", () => {
      // Triangle: 0 → 1 → 2 → 0
      const adj = [new Set([1]), new Set([2]), new Set([0])];
      const out: { x: number; y: number }[] = new Array(3);
      layoutForceDirected([0, 1, 2], adj, 150, out);

      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          const dist = Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y);
          expect(dist).toBeGreaterThan(20);
        }
      }
    });

    it("places connected states closer than unconnected states", () => {
      // Path: 0 → 1 → 2 → 3 (chain structure)
      const adj = [new Set([1]), new Set([2]), new Set([3]), new Set<number>()];
      const out: { x: number; y: number }[] = new Array(4);
      layoutForceDirected([0, 1, 2, 3], adj, 150, out);

      // Adjacent pairs should be closer than endpoints
      const dist01 = Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y);
      const dist03 = Math.hypot(out[0].x - out[3].x, out[0].y - out[3].y);
      expect(dist01).toBeLessThan(dist03);
    });

    it("handles single state", () => {
      const adj = [new Set<number>()];
      const out: { x: number; y: number }[] = new Array(1);
      layoutForceDirected([0], adj, 150, out);
      expect(out[0]).toBeDefined();
      expect(out[0].x).toBe(0);
      expect(out[0].y).toBe(0);
    });

    it("handles two states", () => {
      const adj = [new Set([1]), new Set([0])];
      const out: { x: number; y: number }[] = new Array(2);
      layoutForceDirected([0, 1], adj, 150, out);
      const dist = Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y);
      expect(dist).toBeGreaterThan(20);
    });

    it("pulls bidirectional pairs closer than unidirectional", () => {
      // 0 ↔ 1 (bidir), 0 → 2 (unidir), all repel equally
      const adj = [new Set([1, 2]), new Set([0]), new Set<number>()];
      const out: { x: number; y: number }[] = new Array(3);
      layoutForceDirected([0, 1, 2], adj, 150, out);

      const dist01 = Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y);
      const dist02 = Math.hypot(out[0].x - out[2].x, out[0].y - out[2].y);
      expect(dist01).toBeLessThan(dist02);
    });
  });

  describe("rotateStartLeft", () => {
    it("makes start state the leftmost", () => {
      // Start at right side of a triangle
      const positions = [
        { x: 100, y: 0 }, // state 0 (start) — on the right
        { x: -50, y: 87 }, // state 1
        { x: -50, y: -87 }, // state 2
      ];
      rotateStartLeft(positions, [0, 1, 2], 0);

      // After rotation, state 0 should be leftmost
      expect(positions[0].x).toBeLessThanOrEqual(positions[1].x);
      expect(positions[0].x).toBeLessThanOrEqual(positions[2].x);
    });

    it("is a no-op for single state", () => {
      const positions = [{ x: 50, y: 30 }];
      rotateStartLeft(positions, [0], 0);
      expect(positions[0].x).toBe(50);
      expect(positions[0].y).toBe(30);
    });

    it("preserves relative distances between states", () => {
      const positions = [
        { x: 100, y: 0 },
        { x: -50, y: 87 },
        { x: -50, y: -87 },
      ];
      const distBefore = Math.hypot(
        positions[0].x - positions[1].x,
        positions[0].y - positions[1].y,
      );

      rotateStartLeft(positions, [0, 1, 2], 0);

      const distAfter = Math.hypot(
        positions[0].x - positions[1].x,
        positions[0].y - positions[1].y,
      );
      expect(distAfter).toBeCloseTo(distBefore, 5);
    });
  });

  describe("scaleToTargetSpacing", () => {
    it("scales positions to match target average edge length", () => {
      const positions = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ];
      const adj = [new Set([1]), new Set([2]), new Set<number>()];
      scaleToTargetSpacing(positions, [0, 1, 2], adj, 150);

      const d01 = Math.hypot(positions[0].x - positions[1].x, positions[0].y - positions[1].y);
      const d12 = Math.hypot(positions[1].x - positions[2].x, positions[1].y - positions[2].y);
      const avg = (d01 + d12) / 2;
      expect(avg).toBeCloseTo(150, 0);
    });

    it("is a no-op when there are no edges", () => {
      const positions = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ];
      const adj = [new Set<number>(), new Set<number>()];
      scaleToTargetSpacing(positions, [0, 1], adj, 150);

      // Positions unchanged
      expect(positions[0]).toEqual({ x: 10, y: 20 });
      expect(positions[1]).toEqual({ x: 30, y: 40 });
    });

    it("preserves layout topology (relative angles unchanged)", () => {
      const positions = [
        { x: 0, y: 0 },
        { x: 30, y: 40 }, // angle ~53°
        { x: 60, y: 0 },
      ];
      const adj = [new Set([1]), new Set([2]), new Set<number>()];

      const angleBefore = Math.atan2(
        positions[1].y - positions[0].y,
        positions[1].x - positions[0].x,
      );

      scaleToTargetSpacing(positions, [0, 1, 2], adj, 150);

      const angleAfter = Math.atan2(
        positions[1].y - positions[0].y,
        positions[1].x - positions[0].x,
      );
      expect(angleAfter).toBeCloseTo(angleBefore, 5);
    });
  });
});
