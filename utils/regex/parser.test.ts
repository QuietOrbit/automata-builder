import { describe, expect, it } from "vitest";
import { parseRegex } from "./parser";
import { RegexNodeType } from "~/types/regex";

describe("utils/regex/parser", () => {
  describe("atoms", () => {
    it("parses a single symbol", () => {
      const result = parseRegex("a");
      expect(result).toEqual({ type: RegexNodeType.Symbol, value: "a" });
    });

    it("parses epsilon", () => {
      const result = parseRegex("ε");
      expect(result).toEqual({ type: RegexNodeType.Epsilon });
    });

    it("parses empty set", () => {
      const result = parseRegex("∅");
      expect(result).toEqual({ type: RegexNodeType.Empty });
    });

    it("parses parenthesized expression", () => {
      const result = parseRegex("(a)");
      expect(result).toEqual({ type: RegexNodeType.Symbol, value: "a" });
    });
  });

  describe("star", () => {
    it("parses a*", () => {
      const result = parseRegex("a*");
      expect(result).toEqual({
        type: RegexNodeType.Star,
        operand: { type: RegexNodeType.Symbol, value: "a" },
      });
    });

    it("parses a** as nested stars", () => {
      const result = parseRegex("a**");
      expect(result).toEqual({
        type: RegexNodeType.Star,
        operand: {
          type: RegexNodeType.Star,
          operand: { type: RegexNodeType.Symbol, value: "a" },
        },
      });
    });
  });

  describe("concatenation", () => {
    it("parses ab as concat", () => {
      const result = parseRegex("ab");
      expect(result).toEqual({
        type: RegexNodeType.Concat,
        left: { type: RegexNodeType.Symbol, value: "a" },
        right: { type: RegexNodeType.Symbol, value: "b" },
      });
    });

    it("parses abc as left-associative concat", () => {
      const result = parseRegex("abc");
      expect(result).toEqual({
        type: RegexNodeType.Concat,
        left: {
          type: RegexNodeType.Concat,
          left: { type: RegexNodeType.Symbol, value: "a" },
          right: { type: RegexNodeType.Symbol, value: "b" },
        },
        right: { type: RegexNodeType.Symbol, value: "c" },
      });
    });
  });

  describe("union", () => {
    it("parses a∪b", () => {
      const result = parseRegex("a∪b");
      expect(result).toEqual({
        type: RegexNodeType.Union,
        left: { type: RegexNodeType.Symbol, value: "a" },
        right: { type: RegexNodeType.Symbol, value: "b" },
      });
    });

    it("parses a∪b∪c as left-associative union", () => {
      const result = parseRegex("a∪b∪c");
      expect(result).toEqual({
        type: RegexNodeType.Union,
        left: {
          type: RegexNodeType.Union,
          left: { type: RegexNodeType.Symbol, value: "a" },
          right: { type: RegexNodeType.Symbol, value: "b" },
        },
        right: { type: RegexNodeType.Symbol, value: "c" },
      });
    });
  });

  describe("precedence", () => {
    it("star binds tighter than concat: ab* = a(b*)", () => {
      const result = parseRegex("ab*");
      expect(result).toEqual({
        type: RegexNodeType.Concat,
        left: { type: RegexNodeType.Symbol, value: "a" },
        right: {
          type: RegexNodeType.Star,
          operand: { type: RegexNodeType.Symbol, value: "b" },
        },
      });
    });

    it("concat binds tighter than union: a∪bc = a∪(bc)", () => {
      const result = parseRegex("a∪bc");
      expect(result).toEqual({
        type: RegexNodeType.Union,
        left: { type: RegexNodeType.Symbol, value: "a" },
        right: {
          type: RegexNodeType.Concat,
          left: { type: RegexNodeType.Symbol, value: "b" },
          right: { type: RegexNodeType.Symbol, value: "c" },
        },
      });
    });

    it("parentheses override precedence: (a∪b)c", () => {
      const result = parseRegex("(a∪b)c");
      expect(result).toEqual({
        type: RegexNodeType.Concat,
        left: {
          type: RegexNodeType.Union,
          left: { type: RegexNodeType.Symbol, value: "a" },
          right: { type: RegexNodeType.Symbol, value: "b" },
        },
        right: { type: RegexNodeType.Symbol, value: "c" },
      });
    });
  });

  describe("complex expressions", () => {
    it("parses (a∪b)*abb", () => {
      const result = parseRegex("(a∪b)*abb");
      expect(result.type).toBe(RegexNodeType.Concat);
    });

    it("parses (a∪b)*", () => {
      const result = parseRegex("(a∪b)*");
      expect(result).toEqual({
        type: RegexNodeType.Star,
        operand: {
          type: RegexNodeType.Union,
          left: { type: RegexNodeType.Symbol, value: "a" },
          right: { type: RegexNodeType.Symbol, value: "b" },
        },
      });
    });

    it("parses ε∪a as union of epsilon and symbol", () => {
      const result = parseRegex("ε∪a");
      expect(result).toEqual({
        type: RegexNodeType.Union,
        left: { type: RegexNodeType.Epsilon },
        right: { type: RegexNodeType.Symbol, value: "a" },
      });
    });
  });

  describe("error handling", () => {
    it("throws on empty input", () => {
      expect(() => parseRegex("")).toThrow();
    });

    it("throws on unmatched opening paren", () => {
      expect(() => parseRegex("(a")).toThrow(/Expected '\)'/i);
    });

    it("throws on unmatched closing paren", () => {
      expect(() => parseRegex("a)")).toThrow(/Unexpected/i);
    });

    it("throws on leading union operator", () => {
      expect(() => parseRegex("∪a")).toThrow();
    });

    it("throws on trailing union operator", () => {
      expect(() => parseRegex("a∪")).toThrow();
    });

    it("throws on leading star", () => {
      expect(() => parseRegex("*a")).toThrow();
    });

    it("includes position in error message", () => {
      try {
        parseRegex("a)");
        expect.fail("Should have thrown");
      }
      catch (e) {
        expect((e as Error).message).toMatch(/position/i);
      }
    });
  });
});
