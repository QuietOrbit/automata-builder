import { RegexNodeType } from "~/types/regex";
import type { RegexNode } from "~/types/regex";
import { tokenize, TokenType } from "./tokenizer";
import type { Token } from "./tokenizer";

/**
 * Error thrown when the parser encounters invalid regex syntax.
 * Includes the position in the original input string.
 */
export class RegexParseError extends Error {
  constructor(message: string, public readonly position: number) {
    super(`${message} (at position ${position})`);
    this.name = "RegexParseError";
  }
}

/**
 * Recursive-descent parser for Sipser-style regular expressions.
 *
 * Grammar (precedence tightest-to-loosest: star > concat > union):
 * ```
 * expression → union
 * union      → concat ('∪' concat)*
 * concat     → star (star)*
 * star       → atom '*'*
 * atom       → '(' expression ')' | symbol | 'ε' | '∅'
 * ```
 */
class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  /** Return the current token without consuming it. */
  private peek(): Token {
    return this.tokens[this.pos];
  }

  /** Consume and return the current token. */
  private advance(): Token {
    return this.tokens[this.pos++];
  }

  /** Consume a token of the expected type, or throw. */
  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      const expected = type === TokenType.RParen ? "Expected ')'" : `Expected ${type}`;
      throw new RegexParseError(expected, token.position);
    }
    return this.advance();
  }

  /** Check whether the current token can start an atom. */
  private isAtomStart(): boolean {
    const type = this.peek().type;
    return type === TokenType.Symbol
      || type === TokenType.Epsilon
      || type === TokenType.EmptySet
      || type === TokenType.LParen;
  }

  /** Top-level: parse a full expression. */
  parse(): RegexNode {
    const node = this.parseUnion();
    const remaining = this.peek();
    if (remaining.type !== TokenType.EOF) {
      throw new RegexParseError(
        `Unexpected '${remaining.value}'`, remaining.position,
      );
    }
    return node;
  }

  /** union → concat ('∪' concat)* */
  private parseUnion(): RegexNode {
    let left = this.parseConcat();
    while (this.peek().type === TokenType.Union) {
      this.advance();
      const right = this.parseConcat();
      left = { type: RegexNodeType.Union, left, right };
    }
    return left;
  }

  /** concat → star (star)* */
  private parseConcat(): RegexNode {
    let left = this.parseStar();
    while (this.isAtomStart()) {
      const right = this.parseStar();
      left = { type: RegexNodeType.Concat, left, right };
    }
    return left;
  }

  /** star → atom '*'* */
  private parseStar(): RegexNode {
    let node = this.parseAtom();
    while (this.peek().type === TokenType.Star) {
      this.advance();
      node = { type: RegexNodeType.Star, operand: node };
    }
    return node;
  }

  /** atom → '(' expression ')' | symbol | 'ε' | '∅' */
  private parseAtom(): RegexNode {
    const token = this.peek();

    switch (token.type) {
      case TokenType.LParen: {
        this.advance();
        const inner = this.parseUnion();
        this.expect(TokenType.RParen);
        return inner;
      }
      case TokenType.Symbol: {
        this.advance();
        return { type: RegexNodeType.Symbol, value: token.value };
      }
      case TokenType.Epsilon: {
        this.advance();
        return { type: RegexNodeType.Epsilon };
      }
      case TokenType.EmptySet: {
        this.advance();
        return { type: RegexNodeType.Empty };
      }
      default:
        throw new RegexParseError(
          `Unexpected '${token.value || "end of input"}'`, token.position,
        );
    }
  }
}

/**
 * Parse a Sipser-style regex string into an AST.
 *
 * @param input - The regex string (e.g., "(a ∪ b)*abb").
 * @returns The root node of the parsed AST.
 * @throws {RegexParseError} If the input is syntactically invalid.
 */
export function parseRegex(input: string): RegexNode {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  return parser.parse();
}
