import { describe, expect, it } from "vitest";
import { regexToNfa } from "./thompson";
import { AutomatonType, EPSILON } from "~/types/automaton";

describe("utils/regex/thompson", () => {
  describe("basic constructions", () => {
    it("builds NFA for single symbol 'a'", () => {
      const result = regexToNfa("a");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.states).toHaveLength(2);
      expect(result.alphabet).toEqual(["a"]);
      expect(result.acceptStates).toHaveLength(1);
      expect(result.startState).toBe(result.states[0]);
      const startTransitions = result.transitions[result.startState];
      expect(startTransitions["a"]).toContain(result.acceptStates[0]);
    });

    it("builds NFA for epsilon", () => {
      const result = regexToNfa("ε");
      expect(result.states).toHaveLength(2);
      expect(result.alphabet).toEqual([]);
      const startTransitions = result.transitions[result.startState];
      expect(startTransitions[EPSILON]).toContain(result.acceptStates[0]);
    });

    it("builds NFA for empty set", () => {
      const result = regexToNfa("∅");
      expect(result.states).toHaveLength(2);
      expect(result.acceptStates).toHaveLength(1);
      // Start has no transitions — accept state is unreachable
      const startTransitions = result.transitions[result.startState];
      expect(startTransitions).toBeUndefined();
    });
  });

  describe("union", () => {
    it("builds NFA for a∪b", () => {
      const result = regexToNfa("a∪b");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.alphabet).toEqual(["a", "b"]);
      // 2 per branch + 2 for union wrapper = 6
      expect(result.states).toHaveLength(6);
      expect(result.acceptStates).toHaveLength(1);
    });
  });

  describe("concatenation", () => {
    it("builds NFA for ab", () => {
      const result = regexToNfa("ab");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.alphabet).toEqual(["a", "b"]);
      expect(result.states.length).toBeGreaterThanOrEqual(4);
      expect(result.acceptStates).toHaveLength(1);
    });
  });

  describe("star", () => {
    it("builds NFA for a*", () => {
      const result = regexToNfa("a*");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.alphabet).toEqual(["a"]);
      // 2 for inner + 2 for star wrapper = 4
      expect(result.states).toHaveLength(4);
      expect(result.acceptStates).toHaveLength(1);
      // New start has ε to inner start AND ε to new accept
      const startTransitions = result.transitions[result.startState];
      expect(startTransitions[EPSILON]).toHaveLength(2);
    });
  });

  describe("complex expressions", () => {
    it("builds NFA for (a∪b)*", () => {
      const result = regexToNfa("(a∪b)*");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.alphabet).toEqual(["a", "b"]);
      expect(result.acceptStates).toHaveLength(1);
    });

    it("builds NFA for (a∪b)*abb", () => {
      const result = regexToNfa("(a∪b)*abb");
      expect(result.type).toBe(AutomatonType.NFA);
      expect(result.alphabet).toEqual(["a", "b"]);
      expect(result.acceptStates).toHaveLength(1);
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
  });
});
