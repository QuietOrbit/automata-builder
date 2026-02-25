import { describe, expect, it, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAutomatonStore } from "../automaton";
import { AutomatonType, EPSILON } from "~/types/automaton";

describe("stores/automaton", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("initial state", () => {
    it("starts as an untitled DFA with no states or transitions", () => {
      const store = useAutomatonStore();
      expect(store.name).toBe("Untitled DFA");
      expect(store.type).toBe(AutomatonType.DFA);
      expect(store.states).toEqual([]);
      expect(store.transitions).toEqual([]);
    });
  });

  describe("addState", () => {
    it("creates a state with auto-generated name", () => {
      const store = useAutomatonStore();
      const state = store.addState({ x: 100, y: 200 });
      expect(state.name).toBe("q0");
      expect(state.position).toEqual({ x: 100, y: 200 });
    });

    it("marks the first state as start", () => {
      const store = useAutomatonStore();
      const first = store.addState({ x: 0, y: 0 });
      expect(first.isStart).toBe(true);
    });

    it("does not mark subsequent states as start", () => {
      const store = useAutomatonStore();
      store.addState({ x: 0, y: 0 });
      const second = store.addState({ x: 100, y: 0 });
      expect(second.isStart).toBe(false);
    });

    it("auto-increments state names", () => {
      const store = useAutomatonStore();
      store.addState({ x: 0, y: 0 });
      store.addState({ x: 100, y: 0 });
      store.addState({ x: 200, y: 0 });
      expect(store.states.map(s => s.name)).toEqual(["q0", "q1", "q2"]);
    });
  });

  describe("removeState", () => {
    it("removes the state", () => {
      const store = useAutomatonStore();
      const state = store.addState({ x: 0, y: 0 });
      store.removeState(state.id);
      expect(store.states).toHaveLength(0);
    });

    it("removes all connected transitions", () => {
      const store = useAutomatonStore();
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      store.addTransition(s0.id, s1.id, "a");
      store.addTransition(s1.id, s0.id, "b");
      store.removeState(s0.id);
      expect(store.transitions).toHaveLength(0);
    });
  });

  describe("updateState", () => {
    it("updates name", () => {
      const store = useAutomatonStore();
      const state = store.addState({ x: 0, y: 0 });
      store.updateState(state.id, { name: "start" });
      expect(store.states[0].name).toBe("start");
    });

    it("updates position", () => {
      const store = useAutomatonStore();
      const state = store.addState({ x: 0, y: 0 });
      store.updateState(state.id, { position: { x: 50, y: 50 } });
      expect(store.states[0].position).toEqual({ x: 50, y: 50 });
    });

    it("does nothing for unknown IDs", () => {
      const store = useAutomatonStore();
      store.addState({ x: 0, y: 0 });
      store.updateState("nonexistent", { name: "nope" });
      expect(store.states[0].name).toBe("q0");
    });
  });

  describe("setStartState", () => {
    it("designates a state as start and clears previous", () => {
      const store = useAutomatonStore();
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      store.setStartState(s1.id);
      expect(store.states.find(s => s.id === s0.id)!.isStart).toBe(false);
      expect(store.states.find(s => s.id === s1.id)!.isStart).toBe(true);
    });
  });

  describe("addTransition", () => {
    it("creates a transition between two states", () => {
      const store = useAutomatonStore();
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      const t = store.addTransition(s0.id, s1.id, "a");
      expect(t.sourceId).toBe(s0.id);
      expect(t.targetId).toBe(s1.id);
      expect(t.symbol).toBe("a");
    });

    it("replaces existing transition on same (source, symbol) in DFA mode", () => {
      const store = useAutomatonStore();
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      const s2 = store.addState({ x: 200, y: 0 });
      store.addTransition(s0.id, s1.id, "a");
      store.addTransition(s0.id, s2.id, "a");
      expect(store.transitions).toHaveLength(1);
      expect(store.transitions[0].targetId).toBe(s2.id);
    });

    it("allows duplicate (source, symbol) in NFA mode", () => {
      const store = useAutomatonStore();
      store.setType(AutomatonType.NFA);
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      const s2 = store.addState({ x: 200, y: 0 });
      store.addTransition(s0.id, s1.id, "a");
      store.addTransition(s0.id, s2.id, "a");
      expect(store.transitions).toHaveLength(2);
    });
  });

  describe("removeTransition / removeTransitions", () => {
    it("removes a single transition", () => {
      const store = useAutomatonStore();
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      const t = store.addTransition(s0.id, s1.id, "a");
      store.removeTransition(t.id);
      expect(store.transitions).toHaveLength(0);
    });

    it("removes multiple transitions at once", () => {
      const store = useAutomatonStore();
      store.setType(AutomatonType.NFA);
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      const t1 = store.addTransition(s0.id, s1.id, "a");
      const t2 = store.addTransition(s0.id, s1.id, "b");
      store.addTransition(s0.id, s1.id, "c");
      store.removeTransitions([t1.id, t2.id]);
      expect(store.transitions).toHaveLength(1);
      expect(store.transitions[0].symbol).toBe("c");
    });
  });

  describe("updateTransitionTarget", () => {
    it("redirects a transition to a new target", () => {
      const store = useAutomatonStore();
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      const s2 = store.addState({ x: 200, y: 0 });
      const t = store.addTransition(s0.id, s1.id, "a");
      store.updateTransitionTarget(t.id, s2.id);
      expect(store.transitions[0].targetId).toBe(s2.id);
    });
  });

  describe("setType", () => {
    it("changes type from DFA to NFA", () => {
      const store = useAutomatonStore();
      store.setType(AutomatonType.NFA);
      expect(store.type).toBe(AutomatonType.NFA);
    });

    it("updates name suffix", () => {
      const store = useAutomatonStore();
      expect(store.name).toBe("Untitled DFA");
      store.setType(AutomatonType.NFA);
      expect(store.name).toBe("Untitled NFA");
    });
  });

  describe("clear", () => {
    it("resets states and transitions", () => {
      const store = useAutomatonStore();
      store.addState({ x: 0, y: 0 });
      store.addState({ x: 100, y: 0 });
      store.addTransition(store.states[0].id, store.states[1].id, "a");
      store.clear();
      expect(store.states).toEqual([]);
      expect(store.transitions).toEqual([]);
    });

    it("generates a new ID", () => {
      const store = useAutomatonStore();
      const oldId = store.id;
      store.clear();
      expect(store.id).not.toBe(oldId);
    });
  });

  describe("alphabet", () => {
    it("starts with an empty alphabet", () => {
      const store = useAutomatonStore();
      expect(store.alphabet).toEqual([]);
    });

    it("setAlphabet replaces the alphabet", () => {
      const store = useAutomatonStore();
      store.setAlphabet(["a", "b"]);
      expect(store.alphabet).toEqual(["a", "b"]);
    });

    it("setAlphabet trims whitespace and deduplicates", () => {
      const store = useAutomatonStore();
      store.setAlphabet([" a ", "b", "a", " b"]);
      expect(store.alphabet).toEqual(["a", "b"]);
    });

    it("setAlphabet filters empty strings", () => {
      const store = useAutomatonStore();
      store.setAlphabet(["a", "", "b", " "]);
      expect(store.alphabet).toEqual(["a", "b"]);
    });

    it("setAlphabet sorts alphabetically", () => {
      const store = useAutomatonStore();
      store.setAlphabet(["c", "a", "b"]);
      expect(store.alphabet).toEqual(["a", "b", "c"]);
    });

    it("addSymbol appends a new symbol and sorts", () => {
      const store = useAutomatonStore();
      store.setAlphabet(["b"]);
      store.addSymbol("a");
      expect(store.alphabet).toEqual(["a", "b"]);
    });

    it("addSymbol ignores duplicates", () => {
      const store = useAutomatonStore();
      store.setAlphabet(["a"]);
      store.addSymbol("a");
      expect(store.alphabet).toEqual(["a"]);
    });

    it("removeSymbol removes the symbol", () => {
      const store = useAutomatonStore();
      store.setAlphabet(["a", "b"]);
      store.removeSymbol("b");
      expect(store.alphabet).toEqual(["a"]);
    });

    it("removeSymbol deletes transitions using that symbol", () => {
      const store = useAutomatonStore();
      store.setAlphabet(["a", "b"]);
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      store.addTransition(s0.id, s1.id, "a");
      store.addTransition(s0.id, s1.id, "b");
      store.removeSymbol("a");
      expect(store.alphabet).toEqual(["b"]);
      expect(store.transitions).toHaveLength(1);
      expect(store.transitions[0].symbol).toBe("b");
    });

    it("addTransition auto-adds symbol to alphabet", () => {
      const store = useAutomatonStore();
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      store.addTransition(s0.id, s1.id, "b");
      store.addTransition(s1.id, s0.id, "a");
      expect(store.alphabet).toEqual(["a", "b"]);
    });

    it("addTransition does not add epsilon to alphabet", () => {
      const store = useAutomatonStore();
      store.setType(AutomatonType.NFA);
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      store.addTransition(s0.id, s1.id, "a");
      store.addTransition(s0.id, s1.id, EPSILON);
      expect(store.alphabet).toEqual(["a"]);
    });

    it("addTransition deduplicates symbols in alphabet", () => {
      const store = useAutomatonStore();
      store.setType(AutomatonType.NFA);
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      const s2 = store.addState({ x: 200, y: 0 });
      store.addTransition(s0.id, s1.id, "a");
      store.addTransition(s0.id, s2.id, "a");
      expect(store.alphabet).toEqual(["a"]);
    });

    it("clear resets alphabet to empty", () => {
      const store = useAutomatonStore();
      store.setAlphabet(["a", "b"]);
      store.clear();
      expect(store.alphabet).toEqual([]);
    });

    it("buildFromTuple populates alphabet from tuple data", () => {
      const store = useAutomatonStore();
      store.buildFromTuple({
        type: AutomatonType.DFA,
        states: ["q0", "q1"],
        alphabet: ["a", "b"],
        transitions: { q0: { a: ["q1"] } },
        startState: "q0",
        acceptStates: ["q1"],
      });
      expect(store.alphabet).toEqual(["a", "b"]);
    });

    it("importJSON restores stored alphabet", () => {
      const store = useAutomatonStore();
      store.setAlphabet(["x", "y"]);
      const s0 = store.addState({ x: 0, y: 0 });
      store.addTransition(s0.id, s0.id, "x");
      const exported = store.exportJSON();
      store.clear();
      store.importJSON(exported);
      expect(store.alphabet).toEqual(["x", "y"]);
    });
  });

  describe("getters", () => {
    describe("startState", () => {
      it("returns the start state", () => {
        const store = useAutomatonStore();
        const s0 = store.addState({ x: 0, y: 0 });
        expect(store.startState?.id).toBe(s0.id);
      });

      it("returns undefined when no states exist", () => {
        const store = useAutomatonStore();
        expect(store.startState).toBeUndefined();
      });
    });

    describe("getTransitionsFrom", () => {
      it("returns transitions from a specific state", () => {
        const store = useAutomatonStore();
        const s0 = store.addState({ x: 0, y: 0 });
        const s1 = store.addState({ x: 100, y: 0 });
        store.addTransition(s0.id, s1.id, "a");
        store.addTransition(s1.id, s0.id, "b");
        expect(store.getTransitionsFrom(s0.id)).toHaveLength(1);
        expect(store.getTransitionsFrom(s0.id)[0].symbol).toBe("a");
      });
    });

    describe("hasBidirectional", () => {
      it("returns true when reverse transition exists", () => {
        const store = useAutomatonStore();
        const s0 = store.addState({ x: 0, y: 0 });
        const s1 = store.addState({ x: 100, y: 0 });
        store.addTransition(s0.id, s1.id, "a");
        store.addTransition(s1.id, s0.id, "b");
        expect(store.hasBidirectional(s0.id, s1.id)).toBe(true);
      });

      it("returns false when no reverse exists", () => {
        const store = useAutomatonStore();
        const s0 = store.addState({ x: 0, y: 0 });
        const s1 = store.addState({ x: 100, y: 0 });
        store.addTransition(s0.id, s1.id, "a");
        expect(store.hasBidirectional(s0.id, s1.id)).toBe(false);
      });
    });

    describe("hasNondeterminism", () => {
      it("detects nondeterministic transitions", () => {
        const store = useAutomatonStore();
        store.setType(AutomatonType.NFA);
        const s0 = store.addState({ x: 0, y: 0 });
        const s1 = store.addState({ x: 100, y: 0 });
        const s2 = store.addState({ x: 200, y: 0 });
        store.addTransition(s0.id, s1.id, "a");
        store.addTransition(s0.id, s2.id, "a");
        expect(store.hasNondeterminism).toBe(true);
      });

      it("returns false for deterministic automata", () => {
        const store = useAutomatonStore();
        const s0 = store.addState({ x: 0, y: 0 });
        const s1 = store.addState({ x: 100, y: 0 });
        store.addTransition(s0.id, s1.id, "a");
        store.addTransition(s0.id, s1.id, "b");
        expect(store.hasNondeterminism).toBe(false);
      });
    });

    describe("hasEpsilonTransitions", () => {
      it("detects epsilon transitions", () => {
        const store = useAutomatonStore();
        store.setType(AutomatonType.NFA);
        const s0 = store.addState({ x: 0, y: 0 });
        const s1 = store.addState({ x: 100, y: 0 });
        store.addTransition(s0.id, s1.id, EPSILON);
        expect(store.hasEpsilonTransitions).toBe(true);
      });

      it("returns false when no epsilon transitions", () => {
        const store = useAutomatonStore();
        const s0 = store.addState({ x: 0, y: 0 });
        const s1 = store.addState({ x: 100, y: 0 });
        store.addTransition(s0.id, s1.id, "a");
        expect(store.hasEpsilonTransitions).toBe(false);
      });
    });

    describe("nextStateName", () => {
      it("returns q0 for empty automaton", () => {
        const store = useAutomatonStore();
        expect(store.nextStateName).toBe("q0");
      });

      it("fills gaps in naming sequence", () => {
        const store = useAutomatonStore();
        store.addState({ x: 0, y: 0 }); // q0
        store.addState({ x: 100, y: 0 }); // q1
        store.removeState(store.states[0].id); // remove q0
        // nextStateName is max(existing) + 1, so q2
        expect(store.nextStateName).toBe("q2");
      });
    });
  });

  describe("exportJSON / importJSON", () => {
    it("round-trips the automaton", () => {
      const store = useAutomatonStore();
      const s0 = store.addState({ x: 0, y: 0 });
      const s1 = store.addState({ x: 100, y: 0 });
      store.addTransition(s0.id, s1.id, "a");
      store.updateState(s1.id, { isAccept: true });

      const exported = store.exportJSON();
      expect(exported.version).toBe(1);

      // Clear and reimport
      store.clear();
      store.importJSON(exported);

      expect(store.states).toHaveLength(2);
      expect(store.transitions).toHaveLength(1);
      expect(store.states.find(s => s.isAccept)).toBeDefined();
    });

    it("ignores unsupported versions", () => {
      const store = useAutomatonStore();
      store.addState({ x: 0, y: 0 });
      const exported = store.exportJSON();
      exported.version = 99 as never;

      store.clear();
      store.importJSON(exported);
      expect(store.states).toHaveLength(0);
    });

    it("deep-copies data (no shared references)", () => {
      const store = useAutomatonStore();
      store.addState({ x: 0, y: 0 });
      const exported = store.exportJSON();

      // Mutate the export
      exported.automaton.states[0].name = "MUTATED";
      expect(store.states[0].name).toBe("q0");
    });
  });

  describe("buildFromTuple", () => {
    it("constructs automaton from tuple definition", () => {
      const store = useAutomatonStore();
      store.buildFromTuple({
        type: AutomatonType.DFA,
        states: ["q0", "q1", "q2"],
        alphabet: ["a", "b"],
        startState: "q0",
        acceptStates: ["q2"],
        transitions: {
          q0: { a: ["q1"] },
          q1: { b: ["q2"] },
        },
      });

      expect(store.states).toHaveLength(3);
      expect(store.transitions).toHaveLength(2);
      expect(store.startState?.name).toBe("q0");
      expect(store.states.find(s => s.name === "q2")!.isAccept).toBe(true);
    });

    it("uses default name when none provided", () => {
      const store = useAutomatonStore();
      store.buildFromTuple({
        type: AutomatonType.NFA,
        states: ["q0"],
        alphabet: [],
        startState: "q0",
        acceptStates: [],
        transitions: {},
      });
      expect(store.name).toBe("Untitled NFA");
    });

    it("uses provided name when given", () => {
      const store = useAutomatonStore();
      store.buildFromTuple({
        name: "My Automaton",
        type: AutomatonType.DFA,
        states: ["q0"],
        alphabet: [],
        startState: "q0",
        acceptStates: [],
        transitions: {},
      });
      expect(store.name).toBe("My Automaton");
    });
  });
});
