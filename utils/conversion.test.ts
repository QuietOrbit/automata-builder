import { describe, expect, it } from "vitest";
import { removeEpsilonTransitions } from "./conversion";
import type { AutomatonState, Transition } from "~/types/automaton";
import { AutomatonType, EPSILON } from "~/types/automaton";

/** Helper to create a minimal state. */
function state(name: string, isStart = false, isAccept = false): AutomatonState {
  return { id: name, name, position: { x: 0, y: 0 }, isStart, isAccept };
}

/** Helper to create a transition. */
function tr(sourceId: string, targetId: string, symbol: string): Transition {
  return { id: `${sourceId}-${symbol}-${targetId}`, sourceId, targetId, symbol };
}

describe("utils/conversion", () => {
  describe("removeEpsilonTransitions", () => {
    it("returns identity when no epsilon transitions exist", () => {
      const states = [state("q0", true), state("q1", false, true)];
      const transitions = [tr("q0", "q1", "a")];

      const result = removeEpsilonTransitions(states, transitions);

      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.states).toEqual(["q0", "q1"]);
      expect(result.startState).toBe("q0");
      expect(result.acceptStates).toEqual(["q1"]);
      expect(result.transitions["q0"]["a"]).toEqual(["q1"]);
    });

    it("removes epsilon and adds reachable transitions", () => {
      // q0 --ε--> q1 --a--> q2
      const states = [state("q0", true), state("q1"), state("q2", false, true)];
      const transitions = [
        tr("q0", "q1", EPSILON),
        tr("q1", "q2", "a"),
      ];

      const result = removeEpsilonTransitions(states, transitions);

      // q0 should now have an 'a' transition to q2 (via epsilon to q1, then a to q2)
      expect(result.transitions["q0"]["a"]).toContain("q2");
      // No epsilon in alphabet
      expect(result.alphabet).not.toContain(EPSILON);
    });

    it("propagates accept status through epsilon closure", () => {
      // q0 --ε--> q1 (accept)
      const states = [state("q0", true), state("q1", false, true)];
      const transitions = [tr("q0", "q1", EPSILON)];

      const result = removeEpsilonTransitions(states, transitions);

      // q0 should become accepting because its ε-closure includes q1
      expect(result.acceptStates).toContain("q0");
      expect(result.acceptStates).toContain("q1");
    });

    it("handles epsilon cycles without infinite loop", () => {
      // q0 --ε--> q1 --ε--> q0
      const states = [state("q0", true), state("q1")];
      const transitions = [
        tr("q0", "q1", EPSILON),
        tr("q1", "q0", EPSILON),
        tr("q1", "q1", "a"),
      ];

      const result = removeEpsilonTransitions(states, transitions);

      // Both should have 'a' transition (they share epsilon closure)
      expect(result.transitions["q0"]["a"]).toContain("q1");
      expect(result.transitions["q1"]["a"]).toContain("q1");
    });
  });
});
