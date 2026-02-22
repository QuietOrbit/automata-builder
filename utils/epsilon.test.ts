import { describe, expect, it } from "vitest";
import { epsilonClosure } from "./epsilon";
import type { Transition } from "~/types/automaton";
import { EPSILON } from "~/types/automaton";

/** Helper to make a transition with just the fields epsilonClosure needs. */
function tr(sourceId: string, targetId: string, symbol: string): Transition {
  return { id: `${sourceId}-${symbol}-${targetId}`, sourceId, targetId, symbol };
}

describe("utils/epsilon", () => {
  describe("epsilonClosure", () => {
    it("returns the input states when no epsilon transitions exist", () => {
      const transitions = [tr("q0", "q1", "a")];
      expect(epsilonClosure(["q0"], transitions)).toEqual(["q0"]);
    });

    it("follows a single epsilon transition", () => {
      const transitions = [tr("q0", "q1", EPSILON)];
      const result = epsilonClosure(["q0"], transitions);
      expect(result).toContain("q0");
      expect(result).toContain("q1");
      expect(result).toHaveLength(2);
    });

    it("follows a chain of epsilon transitions", () => {
      const transitions = [
        tr("q0", "q1", EPSILON),
        tr("q1", "q2", EPSILON),
      ];
      const result = epsilonClosure(["q0"], transitions);
      expect(result).toHaveLength(3);
      expect(result).toContain("q0");
      expect(result).toContain("q1");
      expect(result).toContain("q2");
    });

    it("handles epsilon cycles without infinite loop", () => {
      const transitions = [
        tr("q0", "q1", EPSILON),
        tr("q1", "q0", EPSILON),
      ];
      const result = epsilonClosure(["q0"], transitions);
      expect(result).toHaveLength(2);
    });

    it("computes closure from multiple starting states", () => {
      const transitions = [
        tr("q0", "q2", EPSILON),
        tr("q1", "q3", EPSILON),
      ];
      const result = epsilonClosure(["q0", "q1"], transitions);
      expect(result).toHaveLength(4);
    });

    it("ignores non-epsilon transitions", () => {
      const transitions = [
        tr("q0", "q1", "a"),
        tr("q0", "q2", EPSILON),
      ];
      const result = epsilonClosure(["q0"], transitions);
      expect(result).toContain("q0");
      expect(result).toContain("q2");
      expect(result).not.toContain("q1");
    });
  });
});
