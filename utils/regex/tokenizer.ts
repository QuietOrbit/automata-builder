/** Token types produced by the regex tokenizer. */
export enum TokenType {
  Symbol = "symbol",
  Union = "union",
  Star = "star",
  LParen = "lparen",
  RParen = "rparen",
  Epsilon = "epsilon",
  EmptySet = "emptyset",
  EOF = "eof",
}

/** A single token with its type, raw value, and source position. */
export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

/**
 * Map a single character to its token type.
 * Returns `TokenType.Symbol` for alphabet characters (letters, digits).
 */
function charToTokenType(ch: string): TokenType {
  switch (ch) {
    case "∪": return TokenType.Union;
    case "*": return TokenType.Star;
    case "(": return TokenType.LParen;
    case ")": return TokenType.RParen;
    case "ε": return TokenType.Epsilon;
    case "∅": return TokenType.EmptySet;
    default: return TokenType.Symbol;
  }
}

/**
 * Tokenize a regex string into a flat array of tokens.
 *
 * Whitespace is skipped. Each non-whitespace character becomes one token.
 * The array always ends with an EOF token.
 *
 * @param input - The raw regex string.
 * @returns Array of tokens ending with EOF.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (ch === " " || ch === "\t" || ch === "\n") continue;

    tokens.push({
      type: charToTokenType(ch),
      value: ch,
      position: i,
    });
  }

  tokens.push({ type: TokenType.EOF, value: "", position: input.length });
  return tokens;
}
