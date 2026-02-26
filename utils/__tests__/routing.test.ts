import { describe, expect, it } from "vitest";
import { computeRouting, SECTOR_ANGLES } from "../routing";
import type { AutomatonState, Transition } from "~/types/automaton";

function makeState(id: string, x: number, y: number, opts: Partial<AutomatonState> = {}): AutomatonState {
  return { id, name: id, position: { x, y }, isStart: false, isAccept: false, ...opts };
}

function makeTransition(id: string, sourceId: string, targetId: string, symbol = "a"): Transition {
  return { id, sourceId, targetId, symbol };
}

describe("utils/routing", () => {
  describe("SECTOR_ANGLES", () => {
    it("has 8 sectors", () => {
      expect(SECTOR_ANGLES).toHaveLength(8);
    });

    it("sector 0 is top (approximately -PI/2)", () => {
      expect(SECTOR_ANGLES[0]).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe("computeRouting", () => {
    it("assigns self-loop to top sector when no other transitions exist", () => {
      const states = [makeState("q0", 0, 0)];
      const transitions = [makeTransition("t1", "q0", "q0")];
      computeRouting(states, transitions);
      expect(transitions[0].route).toBeDefined();
      expect(transitions[0].route!.selfLoopSlot).toBe(0); // N = top
    });

    it("assigns self-loop away from incoming transitions", () => {
      // q1 is above q0, so the transition from q1→q0 arrives from the top.
      // Self-loop on q0 should avoid the top sector.
      const states = [
        makeState("q0", 100, 200),
        makeState("q1", 100, 0),
      ];
      const transitions = [
        makeTransition("t1", "q1", "q0", "a"),
        makeTransition("t2", "q0", "q0", "b"),
      ];
      computeRouting(states, transitions);
      expect(transitions[1].route!.selfLoopSlot).not.toBe(0); // not top
    });

    it("assigns sourceAngle and targetAngle for non-self-loop transitions", () => {
      const states = [
        makeState("q0", 0, 0),
        makeState("q1", 200, 0),
      ];
      const transitions = [makeTransition("t1", "q0", "q1")];
      computeRouting(states, transitions);
      expect(transitions[0].route).toBeDefined();
      expect(transitions[0].route!.sourceAngle).toBeDefined();
      expect(transitions[0].route!.targetAngle).toBeDefined();
    });

    it("does not overwrite pinned routes", () => {
      const states = [
        makeState("q0", 0, 0),
        makeState("q1", 200, 0),
      ];
      const transitions = [makeTransition("t1", "q0", "q1")];
      transitions[0].route = { sourceAngle: 42, targetAngle: 222, pinned: true };
      computeRouting(states, transitions);
      expect(transitions[0].route!.sourceAngle).toBe(42);
      expect(transitions[0].route!.targetAngle).toBe(222);
    });

    it("spreads multiple arrows in the same sector", () => {
      // q1 and q2 are both to the right of q0, in the same sector
      const states = [
        makeState("q0", 0, 0),
        makeState("q1", 200, 10),
        makeState("q2", 200, -10),
      ];
      const transitions = [
        makeTransition("t1", "q0", "q1"),
        makeTransition("t2", "q0", "q2"),
      ];
      computeRouting(states, transitions);
      // Source angles from q0 should be different (spread)
      const angle1 = transitions[0].route!.sourceAngle!;
      const angle2 = transitions[1].route!.sourceAngle!;
      expect(angle1).not.toBeCloseTo(angle2, 0);
    });

    it("accounts for start arrow occupying the W sector", () => {
      const states = [makeState("q0", 0, 0, { isStart: true })];
      const transitions = [makeTransition("t1", "q0", "q0", "a")];
      computeRouting(states, transitions);
      // Self-loop should not be on the left (W = slot 6) since start arrow is there
      expect(transitions[0].route!.selfLoopSlot).not.toBe(6);
    });

    it("clamps angles within their sector boundary", () => {
      // Place many targets in similar directions from q0, all mapping to
      // the east sector. All source angles from q0 must stay within the
      // east sector's bounds (0° ± 22.5°), never crossing into adjacent sectors.
      const states = [
        makeState("q0", 0, 0),
        makeState("q1", 200, 5),
        makeState("q2", 200, -5),
        makeState("q3", 200, 15),
        makeState("q4", 200, -15),
        makeState("q5", 200, 25),
      ];
      const transitions = [
        makeTransition("t1", "q0", "q1"),
        makeTransition("t2", "q0", "q2"),
        makeTransition("t3", "q0", "q3"),
        makeTransition("t4", "q0", "q4"),
        makeTransition("t5", "q0", "q5"),
      ];
      computeRouting(states, transitions);

      const sectorHalfWidth = (2 * Math.PI / 8) / 2; // 22.5 degrees in radians
      const eastCenter = 0; // SECTOR_ANGLES[2] = 0 (east)

      for (const t of transitions) {
        const sourceRad = t.route!.sourceAngle! * (Math.PI / 180);
        const diff = Math.abs(sourceRad - eastCenter);
        expect(diff).toBeLessThanOrEqual(sectorHalfWidth + 0.001);
      }
    });

    it("handles empty state list gracefully", () => {
      const transitions: Transition[] = [];
      computeRouting([], transitions);
      // No crash, no routes to assign
    });

    it("handles transitions with missing state references gracefully", () => {
      const states = [makeState("q0", 0, 0)];
      const transitions = [makeTransition("t1", "q0", "missing")];
      computeRouting(states, transitions);
      // Should not crash; transition may not get a route
    });
  });
});
