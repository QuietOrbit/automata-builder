import { describe, expect, it } from "vitest";
import { regexToNfa } from "../thompson";
import { AutomatonType, EPSILON } from "~/types/automaton";

describe("utils/regex/thompson", () => {
  describe("basic constructions", () => {
    it("builds NFA for single symbol 'a'", () => {
      const result = regexToNfa("a");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.states).toHaveLength(2);
      expect(result.alphabet).toEqual(["a"]);
      expect(result.acceptStates).toHaveLength(1);
      expect(result.startState).toBe("q0");
      const startTransitions = result.transitions[result.startState];
      expect(startTransitions["a"]).toContain(result.acceptStates[0]);
    });

    it("builds NFA for epsilon (single accepting start state)", () => {
      const result = regexToNfa("ε");
      // Simplification merges ε-connected states into one
      expect(result.states).toHaveLength(1);
      expect(result.alphabet).toEqual([]);
      expect(result.acceptStates).toContain(result.startState);
    });

    it("builds NFA for empty set (single non-accepting start state)", () => {
      const result = regexToNfa("∅");
      // Accept state is unreachable → removed; only start survives
      expect(result.states).toHaveLength(1);
      expect(result.acceptStates).toHaveLength(0);
      const startTransitions = result.transitions[result.startState];
      expect(startTransitions).toBeUndefined();
    });
  });

  describe("union", () => {
    it("builds NFA for a∪b with 2 states", () => {
      const result = regexToNfa("a∪b");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.alphabet).toEqual(["a", "b"]);
      // Simplified: start --a,b--> accept
      expect(result.states).toHaveLength(2);
      expect(result.acceptStates).toHaveLength(1);
      const startTrans = result.transitions[result.startState];
      expect(startTrans["a"]).toContain(result.acceptStates[0]);
      expect(startTrans["b"]).toContain(result.acceptStates[0]);
    });
  });

  describe("concatenation", () => {
    it("builds NFA for ab with 3 states", () => {
      const result = regexToNfa("ab");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.alphabet).toEqual(["a", "b"]);
      // Simplified: q0 --a--> q1 --b--> q2
      expect(result.states).toHaveLength(3);
      expect(result.acceptStates).toHaveLength(1);
    });
  });

  describe("star", () => {
    it("builds NFA for a* with 1 state (self-loop)", () => {
      const result = regexToNfa("a*");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.alphabet).toEqual(["a"]);
      // Simplified: single accepting start state with a-self-loop
      expect(result.states).toHaveLength(1);
      expect(result.acceptStates).toContain(result.startState);
      const startTrans = result.transitions[result.startState];
      expect(startTrans["a"]).toContain(result.startState);
    });
  });

  describe("complex expressions", () => {
    it("builds NFA for (a∪b)* with 1 state", () => {
      const result = regexToNfa("(a∪b)*");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.alphabet).toEqual(["a", "b"]);
      // All states merge into one with self-loops
      expect(result.states).toHaveLength(1);
      expect(result.acceptStates).toHaveLength(1);
      const startTrans = result.transitions[result.startState];
      expect(startTrans["a"]).toContain(result.startState);
      expect(startTrans["b"]).toContain(result.startState);
    });

    it("builds NFA for (a∪b)*abb with 4 states", () => {
      const result = regexToNfa("(a∪b)*abb");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.alphabet).toEqual(["a", "b"]);
      expect(result.acceptStates).toHaveLength(1);
      // Classic textbook NFA: q0 --a--> {q0,q1}, q0 --b--> q0, q1 --b--> q2, q2 --b--> q3(accept)
      expect(result.states.length).toBeLessThanOrEqual(4);
    });
  });

  describe("state naming", () => {
    it("generates sequential state names q0, q1, ...", () => {
      const result = regexToNfa("a∪b");
      for (const name of result.states) {
        expect(name).toMatch(/^q\d+$/);
      }
      expect(result.states[0]).toBe("q0");
    });
  });

  describe("output format", () => {
    it("produces valid TupleData", () => {
      const result = regexToNfa("a*");
      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("states");
      expect(result).toHaveProperty("alphabet");
      expect(result).toHaveProperty("startState");
      expect(result).toHaveProperty("acceptStates");
      expect(result).toHaveProperty("transitions");
      expect(result.states).toContain(result.startState);
      for (const acc of result.acceptStates) {
        expect(result.states).toContain(acc);
      }
    });

    it("produces no epsilon transitions", () => {
      const result = regexToNfa("(a∪b)*abb");
      for (const state of result.states) {
        const edges = result.transitions[state];
        if (!edges) continue;
        expect(edges[EPSILON]).toBeUndefined();
      }
    });
  });
});
