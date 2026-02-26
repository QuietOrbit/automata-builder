import { describe, expect, it } from "vitest";
import { buildTupleData, ensureCompleteDfa, removeEpsilonTransitions, renameStatesSequentially, subsetConstruction, tupleToArrays } from "../conversion";
import type { AutomatonState, Transition } from "~/types/automaton";
import { AutomatonType, EPSILON } from "~/types/automaton";
import type { TupleData } from "~/stores/automaton";

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

  describe("buildTupleData", () => {
    it("converts states and transitions to TupleData", () => {
      const states = [state("q0", true), state("q1", false, true)];
      const transitions = [tr("q0", "q1", "a"), tr("q1", "q0", "b")];

      const result = buildTupleData(states, transitions);

      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.states).toEqual(["q0", "q1"]);
      expect(result.startState).toBe("q0");
      expect(result.acceptStates).toEqual(["q1"]);
      expect(result.alphabet).toEqual(["a", "b"]);
      expect(result.transitions["q0"]["a"]).toEqual(["q1"]);
      expect(result.transitions["q1"]["b"]).toEqual(["q0"]);
    });

    it("includes epsilon transitions in map but not in alphabet", () => {
      const states = [state("q0", true), state("q1"), state("q2", false, true)];
      const transitions = [
        tr("q0", "q1", EPSILON),
        tr("q1", "q2", "a"),
      ];

      const result = buildTupleData(states, transitions);

      expect(result.alphabet).toEqual(["a"]);
      expect(result.alphabet).not.toContain(EPSILON);
      expect(result.transitions["q0"][EPSILON]).toEqual(["q1"]);
      expect(result.transitions["q1"]["a"]).toEqual(["q2"]);
    });

    it("sorts targets and deduplicates", () => {
      const states = [state("q0", true), state("q1"), state("q2")];
      const transitions = [
        tr("q0", "q2", "a"),
        tr("q0", "q1", "a"),
        tr("q0", "q1", "a"), // duplicate
      ];

      const result = buildTupleData(states, transitions);

      // Sorted and deduplicated
      expect(result.transitions["q0"]["a"]).toEqual(["q1", "q2"]);
    });
  });

  describe("tupleToArrays", () => {
    it("converts TupleData to AutomatonState[] and Transition[]", () => {
      const input: TupleData = {
        type: AutomatonType.DFA,
        states: ["q0", "q1"],
        alphabet: ["a"],
        startState: "q0",
        acceptStates: ["q1"],
        transitions: { q0: { a: ["q1"] }, q1: { a: ["q0"] } },
      };

      const { states: s, transitions: t } = tupleToArrays(input);

      expect(s).toHaveLength(2);
      expect(s[0]).toMatchObject({ id: "q0", name: "q0", isStart: true, isAccept: false });
      expect(s[1]).toMatchObject({ id: "q1", name: "q1", isStart: false, isAccept: true });
      expect(t).toHaveLength(2);
      expect(t).toContainEqual(expect.objectContaining({ sourceId: "q0", targetId: "q1", symbol: "a" }));
      expect(t).toContainEqual(expect.objectContaining({ sourceId: "q1", targetId: "q0", symbol: "a" }));
    });
  });

  describe("subsetConstruction", () => {
    it("converts a simple NFA to DFA", () => {
      // NFA: q0 --a--> q0, q0 --a--> q1, q1 is accept
      const states = [state("q0", true), state("q1", false, true)];
      const transitions = [
        tr("q0", "q0", "a"),
        tr("q0", "q1", "a"),
      ];

      const result = subsetConstruction(states, transitions, ["a"]);

      expect(result.type).toBe(AutomatonType.DFA);
      expect(result.startState).toBe("{q0}");
      expect(result.states).toContain("{q0}");
      expect(result.states).toContain("{q0,q1}");
      // {q0,q1} should be accepting (contains q1)
      expect(result.acceptStates).toContain("{q0,q1}");
    });

    it("creates dead state for missing transitions", () => {
      // NFA: q0 --a--> q1 (accept), no 'b' transitions
      const states = [state("q0", true), state("q1", false, true)];
      const transitions = [tr("q0", "q1", "a")];

      const result = subsetConstruction(states, transitions, ["a", "b"]);

      // Should have a ∅ dead state
      expect(result.states).toContain("∅");
      // ∅ should have self-loops on all symbols
      expect(result.transitions["∅"]["a"]).toEqual(["∅"]);
      expect(result.transitions["∅"]["b"]).toEqual(["∅"]);
    });

    it("names states using sorted set notation", () => {
      // NFA: q0 --a--> q1, q0 --a--> q2
      const states = [state("q0", true), state("q1"), state("q2", false, true)];
      const transitions = [
        tr("q0", "q1", "a"),
        tr("q0", "q2", "a"),
      ];

      const result = subsetConstruction(states, transitions, ["a"]);

      expect(result.startState).toBe("{q0}");
      // The target of 'a' from {q0} should be {q1,q2} (sorted)
      expect(result.states).toContain("{q1,q2}");
    });

    it("handles already-deterministic NFA", () => {
      const states = [state("q0", true), state("q1", false, true)];
      const transitions = [tr("q0", "q1", "a")];

      const result = subsetConstruction(states, transitions, ["a"]);

      expect(result.type).toBe(AutomatonType.DFA);
      expect(result.states).toContain("{q0}");
      expect(result.states).toContain("{q1}");
    });

    it("handles NFA with epsilon transitions gracefully", () => {
      // q0 --ε--> q1 --a--> q2 (accept)
      const states = [state("q0", true), state("q1"), state("q2", false, true)];
      const transitions = [
        tr("q0", "q1", EPSILON),
        tr("q1", "q2", "a"),
      ];

      const result = subsetConstruction(states, transitions, ["a"]);

      expect(result.type).toBe(AutomatonType.DFA);
      // Start state should include q0 and q1 (epsilon closure)
      expect(result.startState).toBe("{q0,q1}");
    });

    it("throws when state count exceeds maximum", () => {
      // "nth-from-last is 'a'" NFA: n+1 states, produces 2^n DFA states.
      // q0 self-loops on {a,b} and nondeterministically starts a counter on 'a'.
      // q1..qn advance on both symbols. qn is accept.
      const n = 11; // 2^11 = 2048 > 1024 cap
      const states: AutomatonState[] = [];
      const transitions: Transition[] = [];

      for (let i = 0; i <= n; i++) {
        states.push(state(`q${i}`, i === 0, i === n));
      }

      // q0 loops on both symbols; on 'a' also branches to q1
      transitions.push(tr("q0", "q0", "a"));
      transitions.push(tr("q0", "q0", "b"));
      transitions.push(tr("q0", "q1", "a"));

      // q1..q(n-1) advance on both symbols
      for (let i = 1; i < n; i++) {
        transitions.push(tr(`q${i}`, `q${i + 1}`, "a"));
        transitions.push(tr(`q${i}`, `q${i + 1}`, "b"));
      }

      expect(() => subsetConstruction(states, transitions, ["a", "b"])).toThrow(/exceeded/i);
    });
  });

  describe("renameStatesSequentially", () => {
    it("renames set-notation states to q0, q1, ...", () => {
      const input: TupleData = {
        type: AutomatonType.DFA,
        states: ["{q0}", "{q0,q1}"],
        alphabet: ["a"],
        startState: "{q0}",
        acceptStates: ["{q0,q1}"],
        transitions: {
          "{q0}": { a: ["{q0,q1}"] },
          "{q0,q1}": { a: ["{q0,q1}"] },
        },
      };

      const result = renameStatesSequentially(input);

      expect(result.states).toEqual(["q0", "q1"]);
      expect(result.startState).toBe("q0");
      expect(result.acceptStates).toEqual(["q1"]);
      expect(result.transitions["q0"]["a"]).toEqual(["q1"]);
      expect(result.transitions["q1"]["a"]).toEqual(["q1"]);
    });

    it("always assigns q0 to the start state", () => {
      const input: TupleData = {
        type: AutomatonType.DFA,
        states: ["{q1,q2}", "{q0}"],
        alphabet: ["a"],
        startState: "{q1,q2}",
        acceptStates: [],
        transitions: {
          "{q1,q2}": { a: ["{q0}"] },
          "{q0}": { a: ["{q1,q2}"] },
        },
      };

      const result = renameStatesSequentially(input);

      // Start state {q1,q2} becomes q0 even though it's not first alphabetically
      expect(result.startState).toBe("q0");
      expect(result.states[0]).toBe("q0");
      expect(result.transitions["q0"]["a"]).toEqual(["q1"]);
      expect(result.transitions["q1"]["a"]).toEqual(["q0"]);
    });

    it("renames dead state ∅ to a sequential name", () => {
      const input: TupleData = {
        type: AutomatonType.DFA,
        states: ["{q0}", "{q1}", "∅"],
        alphabet: ["a", "b"],
        startState: "{q0}",
        acceptStates: ["{q1}"],
        transitions: {
          "{q0}": { a: ["{q1}"], b: ["∅"] },
          "{q1}": { a: ["∅"], b: ["∅"] },
          "∅": { a: ["∅"], b: ["∅"] },
        },
      };

      const result = renameStatesSequentially(input);

      expect(result.states).toEqual(["q0", "q1", "q2"]);
      expect(result.acceptStates).toEqual(["q1"]);
      // Dead state ∅ → q2, with self-loops
      expect(result.transitions["q2"]["a"]).toEqual(["q2"]);
      expect(result.transitions["q2"]["b"]).toEqual(["q2"]);
    });

    it("preserves automaton type", () => {
      const input: TupleData = {
        type: AutomatonType.DFA,
        states: ["X"],
        alphabet: [],
        startState: "X",
        acceptStates: ["X"],
        transitions: {},
      };

      expect(renameStatesSequentially(input).type).toBe(AutomatonType.DFA);
    });

    it("handles already-sequential names as a no-op", () => {
      const input: TupleData = {
        type: AutomatonType.DFA,
        states: ["q0", "q1"],
        alphabet: ["a"],
        startState: "q0",
        acceptStates: ["q1"],
        transitions: {
          q0: { a: ["q1"] },
          q1: { a: ["q0"] },
        },
      };

      const result = renameStatesSequentially(input);

      expect(result).toEqual(input);
    });
  });

  describe("ensureCompleteDfa", () => {
    it("adds trap state when transitions are missing", () => {
      const input: TupleData = {
        type: AutomatonType.DFA,
        states: ["q0", "q1"],
        alphabet: ["a", "b"],
        startState: "q0",
        acceptStates: ["q1"],
        transitions: {
          q0: { a: ["q1"] },
          // q0 missing 'b', q1 missing both
        },
      };

      const result = ensureCompleteDfa(input);

      expect(result.states).toEqual(["q0", "q1", "∅"]);
      // q0's missing 'b' → trap
      expect(result.transitions["q0"]["b"]).toEqual(["∅"]);
      // q1's missing 'a' and 'b' → trap
      expect(result.transitions["q1"]["a"]).toEqual(["∅"]);
      expect(result.transitions["q1"]["b"]).toEqual(["∅"]);
      // Trap self-loops
      expect(result.transitions["∅"]["a"]).toEqual(["∅"]);
      expect(result.transitions["∅"]["b"]).toEqual(["∅"]);
    });

    it("returns unchanged when all transitions present", () => {
      const input: TupleData = {
        type: AutomatonType.DFA,
        states: ["q0"],
        alphabet: ["a"],
        startState: "q0",
        acceptStates: ["q0"],
        transitions: { q0: { a: ["q0"] } },
      };

      const result = ensureCompleteDfa(input);

      expect(result).toBe(input); // Same reference, no copy
    });

    it("preserves existing transitions", () => {
      const input: TupleData = {
        type: AutomatonType.DFA,
        states: ["q0", "q1"],
        alphabet: ["a", "b"],
        startState: "q0",
        acceptStates: ["q1"],
        transitions: {
          q0: { a: ["q1"], b: ["q0"] },
          q1: { a: ["q0"] },
          // q1 missing 'b' only
        },
      };

      const result = ensureCompleteDfa(input);

      expect(result.transitions["q0"]["a"]).toEqual(["q1"]);
      expect(result.transitions["q0"]["b"]).toEqual(["q0"]);
      expect(result.transitions["q1"]["a"]).toEqual(["q0"]);
      expect(result.transitions["q1"]["b"]).toEqual(["∅"]);
    });
  });
});
