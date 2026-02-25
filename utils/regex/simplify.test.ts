import { describe, expect, it } from "vitest";
import { simplifyNfa } from "./simplify";
import { AutomatonType, EPSILON } from "~/types/automaton";
import type { TupleData } from "~/stores/automaton";
import { regexToRawNfa } from "./thompson";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Simulate an NFA (no epsilon transitions expected) on an input string.
 * Returns true if the NFA accepts the string.
 */
function nfaAccepts(tuple: TupleData, input: string): boolean {
  let currentStates = new Set<string>([tuple.startState]);

  for (const symbol of input) {
    const nextStates = new Set<string>();
    for (const state of currentStates) {
      const edges = tuple.transitions[state];
      if (!edges?.[symbol]) continue;
      for (const target of edges[symbol]) {
        nextStates.add(target);
      }
    }
    currentStates = nextStates;
    if (currentStates.size === 0) return false;
  }

  const acceptSet = new Set(tuple.acceptStates);
  return [...currentStates].some(s => acceptSet.has(s));
}

/**
 * Assert that every state in the tuple has no epsilon transitions.
 */
function assertNoEpsilons(tuple: TupleData): void {
  for (const state of tuple.states) {
    const edges = tuple.transitions[state];
    if (!edges) continue;
    expect(edges[EPSILON]).toBeUndefined();
  }
}

/**
 * Assert that all states are reachable from the start state.
 */
function assertNoUnreachable(tuple: TupleData): void {
  const reachable = new Set<string>([tuple.startState]);
  const queue = [tuple.startState];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const edges = tuple.transitions[current];
    if (!edges) continue;
    for (const symbol of tuple.alphabet) {
      if (!edges[symbol]) continue;
      for (const target of edges[symbol]) {
        if (!reachable.has(target)) {
          reachable.add(target);
          queue.push(target);
        }
      }
    }
  }

  for (const state of tuple.states) {
    expect(reachable.has(state), `State ${state} should be reachable`).toBe(true);
  }
}

/**
 * Assert states are named sequentially q0, q1, q2, ...
 */
function assertSequentialNaming(tuple: TupleData): void {
  for (let i = 0; i < tuple.states.length; i++) {
    expect(tuple.states[i]).toBe(`q${i}`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("utils/regex/simplify", () => {
  describe("structural properties", () => {
    it("removes all epsilon transitions", () => {
      const raw = regexToRawNfa("(a∪b)*abb");
      const result = simplifyNfa(raw);
      assertNoEpsilons(result);
    });

    it("removes unreachable states", () => {
      const raw = regexToRawNfa("a∪b");
      const result = simplifyNfa(raw);
      assertNoUnreachable(result);
    });

    it("names states sequentially q0, q1, ...", () => {
      const raw = regexToRawNfa("ab*");
      const result = simplifyNfa(raw);
      assertSequentialNaming(result);
    });

    it("preserves alphabet", () => {
      const raw = regexToRawNfa("(a∪b)*abb");
      const result = simplifyNfa(raw);
      expect(result.alphabet).toEqual(["a", "b"]);
    });

    it("start state is in states list", () => {
      const raw = regexToRawNfa("a*");
      const result = simplifyNfa(raw);
      expect(result.states).toContain(result.startState);
    });

    it("accept states are in states list", () => {
      const raw = regexToRawNfa("(a∪b)*");
      const result = simplifyNfa(raw);
      for (const acc of result.acceptStates) {
        expect(result.states).toContain(acc);
      }
    });

    it("produces NFA type", () => {
      const raw = regexToRawNfa("ab");
      const result = simplifyNfa(raw);
      expect(result.type).toBe(AutomatonType.NFA);
    });
  });

  describe("state count reduction", () => {
    it("a* simplifies to fewer or equal states", () => {
      const raw = regexToRawNfa("a*");
      const result = simplifyNfa(raw);
      expect(result.states.length).toBeLessThanOrEqual(raw.states.length);
    });

    it("reduces a∪b from 6 states to fewer", () => {
      const raw = regexToRawNfa("a∪b");
      const result = simplifyNfa(raw);
      expect(result.states.length).toBeLessThan(raw.states.length);
    });

    it("keeps single symbol 'a' minimal (2 states)", () => {
      const raw = regexToRawNfa("a");
      const result = simplifyNfa(raw);
      expect(result.states).toHaveLength(2);
    });
  });

  describe("language equivalence", () => {
    const testCases: Array<{ regex: string; accept: string[]; reject: string[] }> = [
      {
        regex: "a",
        accept: ["a"],
        reject: ["", "b", "aa", "ab"],
      },
      {
        regex: "a∪b",
        accept: ["a", "b"],
        reject: ["", "ab", "ba", "c", "aa"],
      },
      {
        regex: "ab",
        accept: ["ab"],
        reject: ["", "a", "b", "ba", "abc"],
      },
      {
        regex: "a*",
        accept: ["", "a", "aa", "aaa", "aaaa"],
        reject: ["b", "ab", "ba"],
      },
      {
        regex: "ab*",
        accept: ["a", "ab", "abb", "abbb"],
        reject: ["", "b", "ba", "aab"],
      },
      {
        regex: "(a∪b)*abb",
        accept: ["abb", "aabb", "babb", "ababb", "aababb"],
        reject: ["", "ab", "a", "b", "abba"],
      },
      {
        regex: "(a∪b)*",
        accept: ["", "a", "b", "ab", "ba", "aabb", "abba"],
        reject: ["c"],
      },
      {
        regex: "(ab∪c)*",
        accept: ["", "ab", "c", "abc", "cab", "abab", "cc", "ababc"],
        reject: ["a", "b", "ac", "ba"],
      },
    ];

    for (const { regex, accept, reject } of testCases) {
      it(`preserves language of ${regex}`, () => {
        const raw = regexToRawNfa(regex);
        const result = simplifyNfa(raw);

        for (const str of accept) {
          expect(nfaAccepts(result, str), `"${str}" should be accepted`).toBe(true);
        }
        for (const str of reject) {
          expect(nfaAccepts(result, str), `"${str}" should be rejected`).toBe(false);
        }
      });
    }
  });

  describe("edge cases", () => {
    it("handles epsilon regex (accepts only empty string)", () => {
      const raw = regexToRawNfa("ε");
      const result = simplifyNfa(raw);
      expect(result.acceptStates.length).toBeGreaterThanOrEqual(1);
      expect(nfaAccepts(result, "")).toBe(true);
      expect(result.alphabet).toEqual([]);
    });

    it("handles empty set regex (accepts nothing)", () => {
      const raw = regexToRawNfa("∅");
      const result = simplifyNfa(raw);
      // Start state exists but no accept states should be reachable
      expect(result.states.length).toBeGreaterThanOrEqual(1);
      expect(nfaAccepts(result, "")).toBe(false);
      expect(nfaAccepts(result, "a")).toBe(false);
    });
  });
});
