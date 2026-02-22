import { describe, expect, it } from "vitest";
import { minimizeDfa } from "./minimization";
import type { AutomatonState, Transition } from "~/types/automaton";
import { AutomatonType } from "~/types/automaton";

/** Helper to create a minimal state. */
function state(name: string, isStart = false, isAccept = false): AutomatonState {
  return { id: name, name, position: { x: 0, y: 0 }, isStart, isAccept };
}

/** Helper to create a transition. */
function tr(sourceId: string, targetId: string, symbol: string): Transition {
  return { id: `${sourceId}-${symbol}-${targetId}`, sourceId, targetId, symbol };
}

describe("utils/minimization", () => {
  describe("minimizeDfa", () => {
    it("returns an already-minimal DFA unchanged (no merges)", () => {
      // Minimal 2-state DFA: q0 --a--> q1 (accept), q1 --a--> q0
      const states = [state("q0", true), state("q1", false, true)];
      const transitions = [tr("q0", "q1", "a"), tr("q1", "q0", "a")];

      const result = minimizeDfa(states, transitions);

      expect(result.merges).toHaveLength(0);
      expect(result.tuple.states).toHaveLength(2);
      expect(result.tuple.type).toBe(AutomatonType.DFA);
    });

    it("merges two indistinguishable states", () => {
      // q0 (start) --a--> q1, q0 --b--> q2
      // q1 and q2 are both accept states with identical transitions
      // q1 --a--> q1, q2 --a--> q2
      const states = [
        state("q0", true),
        state("q1", false, true),
        state("q2", false, true),
      ];
      const transitions = [
        tr("q0", "q1", "a"),
        tr("q0", "q2", "b"),
        tr("q1", "q1", "a"),
        tr("q2", "q2", "a"),
      ];

      const result = minimizeDfa(states, transitions);

      expect(result.tuple.states.length).toBeLessThan(3);
      expect(result.merges.length).toBeGreaterThan(0);
    });

    it("removes unreachable states", () => {
      // q0 --a--> q1 (accept), q2 is unreachable
      const states = [
        state("q0", true),
        state("q1", false, true),
        state("q2"),
      ];
      const transitions = [
        tr("q0", "q1", "a"),
        tr("q2", "q1", "a"),
      ];

      const result = minimizeDfa(states, transitions);

      expect(result.tuple.states).not.toContain("q2");
    });

    it("removes dead states", () => {
      // q0 --a--> q1 (accept), q0 --b--> q2 (dead: no path to accept)
      const states = [
        state("q0", true),
        state("q1", false, true),
        state("q2"),
      ];
      const transitions = [
        tr("q0", "q1", "a"),
        tr("q0", "q2", "b"),
        tr("q2", "q2", "a"),
      ];

      const result = minimizeDfa(states, transitions);

      expect(result.tuple.states).not.toContain("q2");
    });

    it("handles empty-language DFA (single non-accept start state)", () => {
      // Only a start state with no accept states — it's live because it's start
      const states = [state("q0", true)];
      const transitions: Transition[] = [];

      const result = minimizeDfa(states, transitions);

      expect(result.tuple.states).toEqual(["q0"]);
      expect(result.tuple.acceptStates).toEqual([]);
      expect(result.merges).toHaveLength(0);
    });

    it("handles multiple equivalence classes with multiple merges", () => {
      // 6-state DFA where pairs (q1,q2) and (q4,q5) are equivalent
      // Group A (non-accept): q0 is start, q3 is distinct
      // Group B (accept): q1 ≡ q2, q4 ≡ q5
      //
      // q0 --a--> q1, q0 --b--> q2
      // q1 --a--> q4, q2 --a--> q5
      // q4 --a--> q1, q5 --a--> q2
      // q3 --a--> q3 (self-loop, non-accept, reachable via some path)
      const states = [
        state("q0", true),
        state("q1", false, true),
        state("q2", false, true),
        state("q3"),
        state("q4", false, true),
        state("q5", false, true),
      ];
      const transitions = [
        tr("q0", "q1", "a"),
        tr("q0", "q2", "b"),
        tr("q1", "q4", "a"),
        tr("q2", "q5", "a"),
        tr("q4", "q1", "a"),
        tr("q5", "q2", "a"),
        tr("q0", "q3", "c"),
        tr("q3", "q3", "a"),
      ];

      const result = minimizeDfa(states, transitions);

      // q3 is dead (can't reach any accept state), so it gets removed.
      // q1 ≡ q2, q4 ≡ q5 — two merges expected
      expect(result.tuple.states.length).toBeLessThan(6);
      expect(result.merges.length).toBeGreaterThanOrEqual(1);
    });

    it("never merges accept states with non-accept states", () => {
      // q0 (start, non-accept), q1 (accept) — must stay separate
      const states = [state("q0", true), state("q1", false, true)];
      const transitions = [tr("q0", "q1", "a"), tr("q1", "q0", "b")];

      const result = minimizeDfa(states, transitions);

      expect(result.tuple.states).toHaveLength(2);
      expect(result.tuple.acceptStates).toHaveLength(1);
      expect(result.merges).toHaveLength(0);
    });

    it("throws when no start state is defined", () => {
      const states = [state("q0"), state("q1", false, true)];
      const transitions = [tr("q0", "q1", "a")];

      expect(() => minimizeDfa(states, transitions)).toThrow(/no start state/i);
    });

    it("formats merge description for two members", () => {
      // q1 and q2 are equivalent accept states
      const states = [
        state("q0", true),
        state("q1", false, true),
        state("q2", false, true),
      ];
      const transitions = [
        tr("q0", "q1", "a"),
        tr("q0", "q2", "b"),
        tr("q1", "q0", "a"),
        tr("q2", "q0", "a"),
      ];

      const result = minimizeDfa(states, transitions);

      expect(result.merges).toHaveLength(1);
      // Should read like "q2 merged into q1" (lexicographic: q1 is representative)
      expect(result.merges[0]).toMatch(/^q2 merged into q1$/);
    });

    it("formats merge description for three or more members", () => {
      // q1, q2, q3 are all equivalent accept states with identical transitions
      const states = [
        state("q0", true),
        state("q1", false, true),
        state("q2", false, true),
        state("q3", false, true),
      ];
      const transitions = [
        tr("q0", "q1", "a"),
        tr("q0", "q2", "b"),
        tr("q0", "q3", "c"),
        tr("q1", "q0", "a"),
        tr("q2", "q0", "a"),
        tr("q3", "q0", "a"),
      ];

      const result = minimizeDfa(states, transitions);

      expect(result.merges).toHaveLength(1);
      // Should read like "q2 and q3 merged into q1" or "q2, q3 merged into q1"
      expect(result.merges[0]).toMatch(/q2 and q3 merged into q1/);
    });
  });
});
