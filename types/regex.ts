/** Discriminator for regex AST node types. */
export enum RegexNodeType {
  Symbol = "symbol",
  Epsilon = "epsilon",
  Empty = "empty",
  Union = "union",
  Concat = "concat",
  Star = "star",
}

/** A node in the regex abstract syntax tree. */
export type RegexNode
  = | SymbolNode
    | EpsilonNode
    | EmptyNode
    | UnionNode
    | ConcatNode
    | StarNode;

/** Literal input symbol (e.g., 'a', 'b', '0', '1'). */
export interface SymbolNode {
  type: RegexNodeType.Symbol;
  value: string;
}

/** The empty string ε — matches without consuming input. */
export interface EpsilonNode {
  type: RegexNodeType.Epsilon;
}

/** The empty set ∅ — matches nothing. */
export interface EmptyNode {
  type: RegexNodeType.Empty;
}

/** Union (alternation): R₁ ∪ R₂. */
export interface UnionNode {
  type: RegexNodeType.Union;
  left: RegexNode;
  right: RegexNode;
}

/** Concatenation: R₁R₂ (juxtaposition). */
export interface ConcatNode {
  type: RegexNodeType.Concat;
  left: RegexNode;
  right: RegexNode;
}

/** Kleene star: R* (zero or more repetitions). */
export interface StarNode {
  type: RegexNodeType.Star;
  operand: RegexNode;
}
