import { describe, expect, it } from "vitest";
import { tokenize, TokenType } from "./tokenizer";

describe("utils/regex/tokenizer", () => {
  it("tokenizes single symbol", () => {
    const tokens = tokenize("a");
    expect(tokens).toEqual([
      { type: TokenType.Symbol, value: "a", position: 0 },
      { type: TokenType.EOF, value: "", position: 1 },
    ]);
  });

  it("tokenizes union operator", () => {
    const tokens = tokenize("a∪b");
    expect(tokens).toHaveLength(4);
    expect(tokens[1]).toEqual({ type: TokenType.Union, value: "∪", position: 1 });
  });

  it("tokenizes star operator", () => {
    const tokens = tokenize("a*");
    expect(tokens).toHaveLength(3);
    expect(tokens[1]).toEqual({ type: TokenType.Star, value: "*", position: 1 });
  });

  it("tokenizes parentheses", () => {
    const tokens = tokenize("(a)");
    expect(tokens).toHaveLength(4);
    expect(tokens[0].type).toBe(TokenType.LParen);
    expect(tokens[2].type).toBe(TokenType.RParen);
  });

  it("tokenizes epsilon", () => {
    const tokens = tokenize("ε");
    expect(tokens[0]).toEqual({ type: TokenType.Epsilon, value: "ε", position: 0 });
  });

  it("tokenizes empty set", () => {
    const tokens = tokenize("∅");
    expect(tokens[0]).toEqual({ type: TokenType.EmptySet, value: "∅", position: 0 });
  });

  it("skips whitespace", () => {
    const tokens = tokenize("a ∪ b");
    expect(tokens).toHaveLength(4);
    expect(tokens[0].value).toBe("a");
    expect(tokens[1].value).toBe("∪");
    expect(tokens[2].value).toBe("b");
  });

  it("tokenizes complex expression", () => {
    const types = tokenize("(a ∪ b)*abb").map(t => t.type);
    expect(types).toEqual([
      TokenType.LParen,
      TokenType.Symbol,
      TokenType.Union,
      TokenType.Symbol,
      TokenType.RParen,
      TokenType.Star,
      TokenType.Symbol,
      TokenType.Symbol,
      TokenType.Symbol,
      TokenType.EOF,
    ]);
  });

  it("tokenizes digit symbols", () => {
    const tokens = tokenize("0∪1");
    expect(tokens[0]).toEqual({ type: TokenType.Symbol, value: "0", position: 0 });
    expect(tokens[2]).toEqual({ type: TokenType.Symbol, value: "1", position: 2 });
  });

  it("returns EOF for empty input", () => {
    const tokens = tokenize("");
    expect(tokens).toEqual([{ type: TokenType.EOF, value: "", position: 0 }]);
  });

  it("returns EOF for whitespace-only input", () => {
    const tokens = tokenize("   ");
    expect(tokens).toEqual([{ type: TokenType.EOF, value: "", position: 3 }]);
  });
});
