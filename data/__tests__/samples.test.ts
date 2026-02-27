import { describe, expect, it } from "vitest";
import { AutomatonType, EPSILON } from "~/types/automaton";
import { SAMPLES, SampleCategory, samplesByCategory } from "../samples";

describe("data/samples", () => {
  describe("unique IDs", () => {
    it("every sample has a unique id", () => {
      const ids = SAMPLES.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("tuple integrity", () => {
    for (const sample of SAMPLES) {
      describe(sample.id, () => {
        it("start state exists in states array", () => {
          expect(sample.tuple.states).toContain(sample.tuple.startState);
        });

        it("all accept states exist in states array", () => {
          for (const acc of sample.tuple.acceptStates) {
            expect(sample.tuple.states).toContain(acc);
          }
        });

        it("transition sources are valid states", () => {
          for (const source of Object.keys(sample.tuple.transitions)) {
            expect(sample.tuple.states).toContain(source);
          }
        });

        it("transition targets are valid states", () => {
          for (const symbolMap of Object.values(sample.tuple.transitions)) {
            for (const targets of Object.values(symbolMap)) {
              for (const target of targets) {
                expect(sample.tuple.states).toContain(target);
              }
            }
          }
        });

        it("transition symbols are in alphabet or EPSILON", () => {
          const validSymbols = new Set([...sample.tuple.alphabet, EPSILON]);
          for (const symbolMap of Object.values(sample.tuple.transitions)) {
            for (const symbol of Object.keys(symbolMap)) {
              expect(validSymbols).toContain(symbol);
            }
          }
        });
      });
    }
  });

  describe("category constraints", () => {
    it("DFA samples have AutomatonType.DFA", () => {
      const dfaSamples = SAMPLES.filter(s => s.category === SampleCategory.DFA);
      for (const sample of dfaSamples) {
        expect(sample.tuple.type).toBe(AutomatonType.DFA);
      }
    });

    it("NFA samples have AutomatonType.NFA", () => {
      const nfaSamples = SAMPLES.filter(s => s.category === SampleCategory.NFA);
      for (const sample of nfaSamples) {
        expect(sample.tuple.type).toBe(AutomatonType.NFA);
      }
    });

    it("NFA-ε samples have at least one epsilon transition", () => {
      const epsSamples = SAMPLES.filter(s => s.category === SampleCategory.NFAEpsilon);
      expect(epsSamples.length).toBeGreaterThan(0);

      for (const sample of epsSamples) {
        const hasEpsilon = Object.values(sample.tuple.transitions).some(
          symbolMap => EPSILON in symbolMap,
        );
        expect(hasEpsilon).toBe(true);
      }
    });
  });

  describe("samplesByCategory()", () => {
    it("covers all samples", () => {
      const map = samplesByCategory();
      let total = 0;
      for (const entries of map.values()) {
        total += entries.length;
      }
      expect(total).toBe(SAMPLES.length);
    });

    it("groups match sample categories", () => {
      const map = samplesByCategory();
      for (const [category, entries] of map) {
        for (const entry of entries) {
          expect(entry.category).toBe(category);
        }
      }
    });
  });
});
