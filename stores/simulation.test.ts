import { describe, expect, it, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSimulationStore } from "./simulation";
import { useAutomatonStore } from "./automaton";
import { AutomatonType, EPSILON, SimulationStatus } from "~/types/automaton";

/**
 * Helper: build a simple DFA and return both stores.
 * Creates: q0 --a--> q1 (accept)
 */
function setupSimpleDFA() {
  const automaton = useAutomatonStore();
  const sim = useSimulationStore();
  const s0 = automaton.addState({ x: 0, y: 0 });
  const s1 = automaton.addState({ x: 100, y: 0 });
  automaton.updateState(s1.id, { isAccept: true });
  automaton.addTransition(s0.id, s1.id, "a");
  return { automaton, sim, s0, s1 };
}

describe("stores/simulation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("initial state", () => {
    it("starts idle with empty input", () => {
      const sim = useSimulationStore();
      expect(sim.status).toBe(SimulationStatus.Idle);
      expect(sim.input).toBe("");
      expect(sim.currentIndex).toBe(0);
      expect(sim.currentStateIds).toEqual([]);
      expect(sim.history).toEqual([]);
    });
  });

  describe("setInput", () => {
    it("sets input and resets simulation", () => {
      const sim = useSimulationStore();
      sim.setInput("abc");
      expect(sim.input).toBe("abc");
      expect(sim.status).toBe(SimulationStatus.Idle);
    });
  });

  describe("getters", () => {
    it("isRunning returns true only when status is running", () => {
      const { sim } = setupSimpleDFA();
      expect(sim.isRunning).toBe(false);
      sim.setInput("a");
      sim.step(); // initialize
      expect(sim.isRunning).toBe(true);
    });

    it("isFinished returns true for terminal states", () => {
      const { sim } = setupSimpleDFA();
      sim.setInput("a");
      sim.step(); // initialize at start
      sim.step(); // read 'a' -> accepted
      expect(sim.isFinished).toBe(true);
    });

    it("canStep returns true from idle with start state", () => {
      setupSimpleDFA();
      const sim = useSimulationStore();
      sim.setInput("a");
      expect(sim.canStep).toBe(true);
    });

    it("canStep returns false from idle with no start state", () => {
      useAutomatonStore(); // empty automaton
      const sim = useSimulationStore();
      expect(sim.canStep).toBe(false);
    });

    it("canStepBack returns false initially", () => {
      const sim = useSimulationStore();
      expect(sim.canStepBack).toBe(false);
    });

    it("currentSymbol returns the next symbol to read", () => {
      const sim = useSimulationStore();
      sim.setInput("abc");
      expect(sim.currentSymbol).toBe("a");
    });

    it("currentSymbol returns null when input is consumed", () => {
      const sim = useSimulationStore();
      sim.setInput("");
      expect(sim.currentSymbol).toBeNull();
    });
  });

  describe("DFA simulation", () => {
    it("accepts matching input", () => {
      const { sim } = setupSimpleDFA();
      sim.setInput("a");
      sim.step(); // initialize
      sim.step(); // read 'a'
      expect(sim.status).toBe(SimulationStatus.Accepted);
    });

    it("rejects when ending in non-accept state", () => {
      const { sim, automaton, s0, s1 } = setupSimpleDFA();
      // Add q1 --b--> q0 (non-accept)
      automaton.addTransition(s1.id, s0.id, "b");
      sim.setInput("ab");
      sim.step(); // initialize
      sim.step(); // read 'a' -> q1
      sim.step(); // read 'b' -> q0
      expect(sim.status).toBe(SimulationStatus.Rejected);
    });

    it("gets stuck when no matching transition exists", () => {
      const { sim } = setupSimpleDFA();
      sim.setInput("b");
      sim.step(); // initialize at q0
      sim.step(); // try 'b' -> no transition
      expect(sim.status).toBe(SimulationStatus.Stuck);
    });

    it("accepts empty string when start state is accept", () => {
      const automaton = useAutomatonStore();
      const sim = useSimulationStore();
      const s0 = automaton.addState({ x: 0, y: 0 });
      automaton.updateState(s0.id, { isAccept: true });
      sim.setInput("");
      sim.step(); // initialize
      expect(sim.status).toBe(SimulationStatus.Accepted);
    });

    it("rejects empty string when start state is not accept", () => {
      const { sim } = setupSimpleDFA();
      sim.setInput("");
      sim.step(); // initialize
      expect(sim.status).toBe(SimulationStatus.Rejected);
    });

    it("builds history on each step", () => {
      const { sim } = setupSimpleDFA();
      sim.setInput("a");
      sim.step(); // initialize
      expect(sim.history).toHaveLength(0);
      sim.step(); // read 'a'
      expect(sim.history).toHaveLength(1);
      expect(sim.history[0].symbolRead).toBe("a");
    });
  });

  describe("NFA simulation", () => {
    it("tracks multiple current states", () => {
      const automaton = useAutomatonStore();
      const sim = useSimulationStore();
      automaton.setType(AutomatonType.NFA);
      const s0 = automaton.addState({ x: 0, y: 0 });
      const s1 = automaton.addState({ x: 100, y: 0 });
      const s2 = automaton.addState({ x: 200, y: 0 });
      automaton.addTransition(s0.id, s1.id, "a");
      automaton.addTransition(s0.id, s2.id, "a");

      sim.setInput("a");
      sim.step(); // initialize at s0
      expect(sim.currentStateIds).toEqual([s0.id]);
      sim.step(); // read 'a' -> s1 and s2
      expect(sim.currentStateIds).toHaveLength(2);
      expect(sim.currentStateIds).toContain(s1.id);
      expect(sim.currentStateIds).toContain(s2.id);
    });

    it("applies epsilon closure at initialization", () => {
      const automaton = useAutomatonStore();
      const sim = useSimulationStore();
      automaton.setType(AutomatonType.NFA);
      const s0 = automaton.addState({ x: 0, y: 0 });
      const s1 = automaton.addState({ x: 100, y: 0 });
      automaton.addTransition(s0.id, s1.id, EPSILON);

      sim.setInput("x");
      sim.step(); // initialize — epsilon closure should include s1
      expect(sim.currentStateIds).toContain(s0.id);
      expect(sim.currentStateIds).toContain(s1.id);
    });

    it("applies epsilon closure after each step", () => {
      const automaton = useAutomatonStore();
      const sim = useSimulationStore();
      automaton.setType(AutomatonType.NFA);
      const s0 = automaton.addState({ x: 0, y: 0 });
      const s1 = automaton.addState({ x: 100, y: 0 });
      const s2 = automaton.addState({ x: 200, y: 0 });
      automaton.updateState(s2.id, { isAccept: true });
      automaton.addTransition(s0.id, s1.id, "a");
      automaton.addTransition(s1.id, s2.id, EPSILON);

      sim.setInput("a");
      sim.step(); // initialize at s0
      sim.step(); // read 'a' -> s1, epsilon -> s2
      expect(sim.currentStateIds).toContain(s1.id);
      expect(sim.currentStateIds).toContain(s2.id);
      expect(sim.status).toBe(SimulationStatus.Accepted);
    });

    it("accepts if any branch reaches an accept state", () => {
      const automaton = useAutomatonStore();
      const sim = useSimulationStore();
      automaton.setType(AutomatonType.NFA);
      const s0 = automaton.addState({ x: 0, y: 0 });
      const s1 = automaton.addState({ x: 100, y: 0 });
      const s2 = automaton.addState({ x: 200, y: 0 });
      automaton.updateState(s2.id, { isAccept: true });
      automaton.addTransition(s0.id, s1.id, "a"); // dead end
      automaton.addTransition(s0.id, s2.id, "a"); // accept

      sim.setInput("a");
      sim.step(); // initialize
      sim.step(); // read 'a'
      expect(sim.status).toBe(SimulationStatus.Accepted);
    });

    it("gets stuck when no branch has a matching transition", () => {
      const automaton = useAutomatonStore();
      const sim = useSimulationStore();
      automaton.setType(AutomatonType.NFA);
      const s0 = automaton.addState({ x: 0, y: 0 });
      automaton.addState({ x: 100, y: 0 }); // s1, unreachable

      sim.setInput("a");
      sim.step(); // initialize at s0
      sim.step(); // 'a' -> no transitions from s0
      expect(sim.status).toBe(SimulationStatus.Stuck);
    });
  });

  describe("stepBack", () => {
    it("restores previous state", () => {
      const { sim, s0 } = setupSimpleDFA();
      sim.setInput("a");
      sim.step(); // initialize at s0
      sim.step(); // read 'a' -> s1
      sim.stepBack();
      expect(sim.currentStateIds).toEqual([s0.id]);
      expect(sim.status).toBe(SimulationStatus.Running);
    });

    it("decrements currentIndex", () => {
      const { sim } = setupSimpleDFA();
      sim.setInput("a");
      sim.step(); // initialize
      sim.step(); // read 'a', index -> 1
      sim.stepBack();
      expect(sim.currentIndex).toBe(0);
    });

    it("does nothing when history is empty", () => {
      const sim = useSimulationStore();
      sim.stepBack();
      expect(sim.status).toBe(SimulationStatus.Idle);
    });

    it("enables canStepBack after a step", () => {
      const { sim } = setupSimpleDFA();
      sim.setInput("a");
      sim.step(); // initialize
      sim.step(); // read 'a'
      expect(sim.canStepBack).toBe(true);
    });
  });

  describe("runToEnd", () => {
    it("runs from idle to completion", () => {
      const { sim } = setupSimpleDFA();
      sim.setInput("a");
      sim.runToEnd();
      expect(sim.status).toBe(SimulationStatus.Accepted);
    });

    it("does not hang on impossible input", () => {
      const { sim } = setupSimpleDFA();
      sim.setInput("b");
      sim.runToEnd();
      expect(sim.status).toBe(SimulationStatus.Stuck);
    });
  });

  describe("reset", () => {
    it("returns to idle state", () => {
      const { sim } = setupSimpleDFA();
      sim.setInput("a");
      sim.step();
      sim.step();
      sim.reset();
      expect(sim.status).toBe(SimulationStatus.Idle);
      expect(sim.currentIndex).toBe(0);
      expect(sim.currentStateIds).toEqual([]);
      expect(sim.history).toEqual([]);
    });
  });
});
