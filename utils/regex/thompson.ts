import { RegexNodeType } from "~/types/regex";
import type { RegexNode } from "~/types/regex";
import { AutomatonType, EPSILON } from "~/types/automaton";
import type { TupleData } from "~/stores/automaton";
import { parseRegex } from "./parser";
import { simplifyNfa } from "./simplify";

/** An NFA fragment with exactly one start and one accept state. */
interface NfaFragment {
  start: number;
  accept: number;
}

/**
 * Builder that accumulates states and transitions while constructing
 * NFA fragments via Thompson's algorithm.
 */
class ThompsonBuilder {
  private stateCount = 0;
  /** Transitions stored as: fromIndex → [{ symbol, toIndex }] */
  private readonly edges = new Map<number, Array<{ symbol: string; to: number }>>();

  /** Allocate a new state and return its index. */
  private newState(): number {
    return this.stateCount++;
  }

  /** Add a transition edge. */
  private addEdge(from: number, symbol: string, to: number): void {
    let list = this.edges.get(from);
    if (!list) {
      list = [];
      this.edges.set(from, list);
    }
    list.push({ symbol, to });
  }

  /** Build an NFA fragment from an AST node. */
  build(node: RegexNode): NfaFragment {
    switch (node.type) {
      case RegexNodeType.Symbol:
        return this.buildSymbol(node.value);
      case RegexNodeType.Epsilon:
        return this.buildEpsilon();
      case RegexNodeType.Empty:
        return this.buildEmpty();
      case RegexNodeType.Union:
        return this.buildUnion(node.left, node.right);
      case RegexNodeType.Concat:
        return this.buildConcat(node.left, node.right);
      case RegexNodeType.Star:
        return this.buildStar(node.operand);
    }
  }

  /** symbol(a): start --a--> accept */
  private buildSymbol(value: string): NfaFragment {
    const start = this.newState();
    const accept = this.newState();
    this.addEdge(start, value, accept);
    return { start, accept };
  }

  /** epsilon: start --ε--> accept */
  private buildEpsilon(): NfaFragment {
    const start = this.newState();
    const accept = this.newState();
    this.addEdge(start, EPSILON, accept);
    return { start, accept };
  }

  /** empty set: start and accept exist, but no edges (accept unreachable). */
  private buildEmpty(): NfaFragment {
    const start = this.newState();
    const accept = this.newState();
    return { start, accept };
  }

  /**
   * union(R₁, R₂):
   *   new start --ε--> R₁.start
   *   new start --ε--> R₂.start
   *   R₁.accept --ε--> new accept
   *   R₂.accept --ε--> new accept
   */
  private buildUnion(left: RegexNode, right: RegexNode): NfaFragment {
    const r1 = this.build(left);
    const r2 = this.build(right);
    const start = this.newState();
    const accept = this.newState();
    this.addEdge(start, EPSILON, r1.start);
    this.addEdge(start, EPSILON, r2.start);
    this.addEdge(r1.accept, EPSILON, accept);
    this.addEdge(r2.accept, EPSILON, accept);
    return { start, accept };
  }

  /** concat(R₁, R₂): R₁.accept --ε--> R₂.start */
  private buildConcat(left: RegexNode, right: RegexNode): NfaFragment {
    const r1 = this.build(left);
    const r2 = this.build(right);
    this.addEdge(r1.accept, EPSILON, r2.start);
    return { start: r1.start, accept: r2.accept };
  }

  /**
   * star(R):
   *   new start --ε--> R.start      (enter loop)
   *   new start --ε--> new accept   (zero repetitions)
   *   R.accept  --ε--> R.start      (loop back)
   *   R.accept  --ε--> new accept   (exit loop)
   */
  private buildStar(operand: RegexNode): NfaFragment {
    const r = this.build(operand);
    const start = this.newState();
    const accept = this.newState();
    this.addEdge(start, EPSILON, r.start);
    this.addEdge(start, EPSILON, accept);
    this.addEdge(r.accept, EPSILON, r.start);
    this.addEdge(r.accept, EPSILON, accept);
    return { start, accept };
  }

  /** Convert the accumulated NFA into TupleData for buildFromTuple(). */
  toTupleData(fragment: NfaFragment): TupleData {
    const states: string[] = [];
    for (let i = 0; i < this.stateCount; i++) {
      states.push(`q${i}`);
    }

    const transitions: Record<string, Record<string, string[]>> = {};
    const alphabetSet = new Set<string>();

    for (const [from, edgeList] of this.edges) {
      const fromName = `q${from}`;
      if (!transitions[fromName]) {
        transitions[fromName] = {};
      }
      for (const edge of edgeList) {
        const toName = `q${edge.to}`;
        if (edge.symbol !== EPSILON) {
          alphabetSet.add(edge.symbol);
        }
        if (!transitions[fromName][edge.symbol]) {
          transitions[fromName][edge.symbol] = [];
        }
        transitions[fromName][edge.symbol].push(toName);
      }
    }

    const alphabet = [...alphabetSet].sort((a, b) => a.localeCompare(b));

    return {
      type: AutomatonType.NFA,
      states,
      alphabet,
      startState: `q${fragment.start}`,
      acceptStates: [`q${fragment.accept}`],
      transitions,
    };
  }
}

/**
 * Parse a regex string and build an unsimplified NFA-ε via Thompson's construction.
 *
 * This is the raw output before simplification — useful for testing the
 * simplification pipeline separately.
 *
 * @param input - A Sipser-style regex string (e.g., "(a ∪ b)*abb").
 * @returns Raw TupleData with epsilon transitions and structural states.
 * @throws {RegexParseError} If the regex string is syntactically invalid.
 */
export function regexToRawNfa(input: string): TupleData {
  const ast = parseRegex(input);
  const builder = new ThompsonBuilder();
  const fragment = builder.build(ast);
  return builder.toTupleData(fragment);
}

/**
 * Parse a regex string and build an equivalent simplified NFA via Thompson's construction.
 *
 * @param input - A Sipser-style regex string (e.g., "(a ∪ b)*abb").
 * @returns Simplified TupleData with no ε-transitions, ready for `buildFromTuple()`.
 * @throws {RegexParseError} If the regex string is syntactically invalid.
 */
export function regexToNfa(input: string): TupleData {
  return simplifyNfa(regexToRawNfa(input));
}
