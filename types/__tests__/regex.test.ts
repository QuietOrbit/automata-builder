import { describe, expect, it } from "vitest";
import { RegexNodeType } from "../regex";
import type { RegexNode } from "../regex";

describe("types/regex", () => {
  it("represents a symbol node", () => {
    const node: RegexNode = { type: RegexNodeType.Symbol, value: "a" };
    expect(node.type).toBe(RegexNodeType.Symbol);
    expect(node.value).toBe("a");
  });

  it("represents an epsilon node", () => {
    const node: RegexNode = { type: RegexNodeType.Epsilon };
    expect(node.type).toBe(RegexNodeType.Epsilon);
  });

  it("represents an empty set node", () => {
    const node: RegexNode = { type: RegexNodeType.Empty };
    expect(node.type).toBe(RegexNodeType.Empty);
  });

  it("represents a union node", () => {
    const node: RegexNode = {
      type: RegexNodeType.Union,
      left: { type: RegexNodeType.Symbol, value: "a" },
      right: { type: RegexNodeType.Symbol, value: "b" },
    };
    expect(node.type).toBe(RegexNodeType.Union);
  });

  it("represents a concat node", () => {
    const node: RegexNode = {
      type: RegexNodeType.Concat,
      left: { type: RegexNodeType.Symbol, value: "a" },
      right: { type: RegexNodeType.Symbol, value: "b" },
    };
    expect(node.type).toBe(RegexNodeType.Concat);
  });

  it("represents a star node", () => {
    const node: RegexNode = {
      type: RegexNodeType.Star,
      operand: { type: RegexNodeType.Symbol, value: "a" },
    };
    expect(node.type).toBe(RegexNodeType.Star);
  });
});
