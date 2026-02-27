import type { TupleData } from "~/stores/automaton";
import { AutomatonType, EPSILON } from "~/types/automaton";

/** Categories for organizing sample machines in the menu. */
export enum SampleCategory {
  DFA = "DFA",
  NFA = "NFA",
  NFAEpsilon = "NFA-ε",
  Advanced = "Advanced",
}

/** A single sample machine entry with metadata and tuple data. */
export interface SampleEntry {
  /** Unique identifier for this sample. */
  id: string;
  /** Display name shown in the menu. */
  name: string;
  /** Formal language description using set notation. */
  description: string;
  /** Category for grouping in the menu. */
  category: SampleCategory;
  /** Full 5-tuple definition, ready for buildFromTuple(). */
  tuple: TupleData;
}

/** All available sample machines. */
export const SAMPLES: SampleEntry[] = [
  // ── DFA ────────────────────────────────────────
  {
    id: "dfa-ends-01",
    name: "Strings ending in 01",
    description: "L = { w ∈ {0,1}* | w ends with 01 }",
    category: SampleCategory.DFA,
    tuple: {
      name: "Strings ending in 01",
      type: AutomatonType.DFA,
      states: ["q0", "q1", "q2"],
      alphabet: ["0", "1"],
      startState: "q0",
      acceptStates: ["q2"],
      transitions: {
        q0: { 0: ["q1"], 1: ["q0"] },
        q1: { 0: ["q1"], 1: ["q2"] },
        q2: { 0: ["q1"], 1: ["q0"] },
      },
    },
  },
  {
    id: "dfa-even-zeros",
    name: "Even number of 0s",
    description: "L = { w ∈ {0,1}* | w has an even number of 0s }",
    category: SampleCategory.DFA,
    tuple: {
      name: "Even number of 0s",
      type: AutomatonType.DFA,
      states: ["q0", "q1"],
      alphabet: ["0", "1"],
      startState: "q0",
      acceptStates: ["q0"],
      transitions: {
        q0: { 0: ["q1"], 1: ["q0"] },
        q1: { 0: ["q0"], 1: ["q1"] },
      },
    },
  },
  {
    id: "dfa-divisible-by-3",
    name: "Divisible by 3",
    description: "L = { w ∈ {0,1}* | binary value of w ≡ 0 (mod 3) }",
    category: SampleCategory.DFA,
    tuple: {
      name: "Divisible by 3",
      type: AutomatonType.DFA,
      states: ["q0", "q1", "q2"],
      alphabet: ["0", "1"],
      startState: "q0",
      acceptStates: ["q0"],
      transitions: {
        q0: { 0: ["q0"], 1: ["q1"] },
        q1: { 0: ["q2"], 1: ["q0"] },
        q2: { 0: ["q1"], 1: ["q2"] },
      },
    },
  },

  // ── NFA ────────────────────────────────────────
  {
    id: "nfa-contains-101",
    name: "Contains 101",
    description: "L = { w ∈ {0,1}* | w contains 101 as a substring }",
    category: SampleCategory.NFA,
    tuple: {
      name: "Contains 101",
      type: AutomatonType.NFA,
      states: ["q0", "q1", "q2", "q3"],
      alphabet: ["0", "1"],
      startState: "q0",
      acceptStates: ["q3"],
      transitions: {
        q0: { 0: ["q0"], 1: ["q0", "q1"] },
        q1: { 0: ["q2"] },
        q2: { 1: ["q3"] },
        q3: { 0: ["q3"], 1: ["q3"] },
      },
    },
  },
  {
    id: "nfa-third-from-last-1",
    name: "Third-from-last is 1",
    description: "L = { w ∈ {0,1}* | the third symbol from the end is 1 }",
    category: SampleCategory.NFA,
    tuple: {
      name: "Third-from-last is 1",
      type: AutomatonType.NFA,
      states: ["q0", "q1", "q2", "q3"],
      alphabet: ["0", "1"],
      startState: "q0",
      acceptStates: ["q3"],
      transitions: {
        q0: { 0: ["q0"], 1: ["q0", "q1"] },
        q1: { 0: ["q2"], 1: ["q2"] },
        q2: { 0: ["q3"], 1: ["q3"] },
      },
    },
  },

  // ── NFA-ε ──────────────────────────────────────
  {
    id: "nfa-eps-union",
    name: "Union via ε-bridges",
    description: "L = { w ∈ {a,b}* | w = aⁿ or w = bⁿ, n ≥ 1 }",
    category: SampleCategory.NFAEpsilon,
    tuple: {
      name: "Union via ε-bridges",
      type: AutomatonType.NFA,
      states: ["q0", "q1", "q2", "q3", "q4"],
      alphabet: ["a", "b"],
      startState: "q0",
      acceptStates: ["q2", "q4"],
      transitions: {
        q0: { [EPSILON]: ["q1", "q3"] },
        q1: { a: ["q1", "q2"] },
        q2: {},
        q3: { b: ["q3", "q4"] },
        q4: {},
      },
    },
  },
  {
    id: "nfa-eps-optional-prefix",
    name: "Optional prefix skip",
    description: "L = { w ∈ {0,1}* | w = 0*1 or w = 1 }",
    category: SampleCategory.NFAEpsilon,
    tuple: {
      name: "Optional prefix skip",
      type: AutomatonType.NFA,
      states: ["q0", "q1", "q2"],
      alphabet: ["0", "1"],
      startState: "q0",
      acceptStates: ["q2"],
      transitions: {
        q0: { 0: ["q0"], [EPSILON]: ["q1"] },
        q1: { 1: ["q2"] },
        q2: {},
      },
    },
  },

  // ── Advanced ───────────────────────────────────
  {
    id: "adv-even-0s-and-1s",
    name: "Even 0s and even 1s",
    description: "L = { w ∈ {0,1}* | w has even 0s and even 1s }",
    category: SampleCategory.Advanced,
    tuple: {
      name: "Even 0s and even 1s",
      type: AutomatonType.DFA,
      states: ["q0", "q1", "q2", "q3"],
      alphabet: ["0", "1"],
      startState: "q0",
      acceptStates: ["q0"],
      transitions: {
        q0: { 0: ["q1"], 1: ["q2"] },
        q1: { 0: ["q0"], 1: ["q3"] },
        q2: { 0: ["q3"], 1: ["q0"] },
        q3: { 0: ["q2"], 1: ["q1"] },
      },
    },
  },
  {
    id: "adv-divisible-by-5",
    name: "Divisible by 5",
    description: "L = { w ∈ {0,1}* | binary value of w ≡ 0 (mod 5) }",
    category: SampleCategory.Advanced,
    tuple: {
      name: "Divisible by 5",
      type: AutomatonType.DFA,
      states: ["q0", "q1", "q2", "q3", "q4"],
      alphabet: ["0", "1"],
      startState: "q0",
      acceptStates: ["q0"],
      transitions: {
        q0: { 0: ["q0"], 1: ["q1"] },
        q1: { 0: ["q2"], 1: ["q3"] },
        q2: { 0: ["q4"], 1: ["q0"] },
        q3: { 0: ["q1"], 1: ["q2"] },
        q4: { 0: ["q3"], 1: ["q4"] },
      },
    },
  },
  {
    id: "adv-same-start-end",
    name: "Starts and ends with same symbol",
    description: "L = { w ∈ {0,1}⁺ | first and last symbols are equal }",
    category: SampleCategory.Advanced,
    tuple: {
      name: "Starts and ends with same symbol",
      type: AutomatonType.NFA,
      states: ["q0", "q1", "q2", "q3", "q4"],
      alphabet: ["0", "1"],
      startState: "q0",
      acceptStates: ["q2", "q4"],
      transitions: {
        q0: { 0: ["q1", "q2"], 1: ["q3", "q4"] },
        q1: { 0: ["q1", "q2"], 1: ["q1"] },
        q2: {},
        q3: { 0: ["q3"], 1: ["q3", "q4"] },
        q4: {},
      },
    },
  },
  {
    id: "adv-concat-epsilon",
    name: "Concatenation via ε",
    description: "L = { w ∈ {0,1}* | w ∈ 0*1 ∪ 1*0 }",
    category: SampleCategory.Advanced,
    tuple: {
      name: "Concatenation via ε",
      type: AutomatonType.NFA,
      states: ["q0", "q1", "q2", "q3", "q4", "q5"],
      alphabet: ["0", "1"],
      startState: "q0",
      acceptStates: ["q5"],
      transitions: {
        q0: { [EPSILON]: ["q1", "q3"] },
        q1: { 0: ["q1"], 1: ["q2"] },
        q2: { [EPSILON]: ["q5"] },
        q3: { 1: ["q3"], 0: ["q4"] },
        q4: { [EPSILON]: ["q5"] },
        q5: {},
      },
    },
  },
];

/**
 * Group all samples by their category.
 *
 * @returns Map from SampleCategory to the samples in that category,
 *          preserving insertion order from the SAMPLES array.
 */
export function samplesByCategory(): Map<SampleCategory, SampleEntry[]> {
  const map = new Map<SampleCategory, SampleEntry[]>();
  for (const sample of SAMPLES) {
    const list = map.get(sample.category);
    if (list) {
      list.push(sample);
    }
    else {
      map.set(sample.category, [sample]);
    }
  }
  return map;
}
