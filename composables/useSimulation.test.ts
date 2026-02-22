import { describe, expect, it, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSimulation } from "./useSimulation";
import { useAutomatonStore } from "~/stores/automaton";
import { SimulationStatus } from "~/types/automaton";

describe("composables/useSimulation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("exposes simulation store and convenience methods", () => {
    const { sim, setInput, step, stepBack, runToEnd, reset } = useSimulation();
    expect(sim).toBeDefined();
    expect(typeof setInput).toBe("function");
    expect(typeof step).toBe("function");
    expect(typeof stepBack).toBe("function");
    expect(typeof runToEnd).toBe("function");
    expect(typeof reset).toBe("function");
  });

  it("delegates setInput to the simulation store", () => {
    const { sim, setInput } = useSimulation();
    setInput("abc");
    expect(sim.input).toBe("abc");
  });

  it("runs a full simulation via composable methods", () => {
    const automaton = useAutomatonStore();
    const s0 = automaton.addState({ x: 0, y: 0 });
    const s1 = automaton.addState({ x: 100, y: 0 });
    automaton.updateState(s1.id, { isAccept: true });
    automaton.addTransition(s0.id, s1.id, "a");

    const { sim, setInput, runToEnd } = useSimulation();
    setInput("a");
    runToEnd();
    expect(sim.status).toBe(SimulationStatus.Accepted);
  });

  it("resets simulation via composable", () => {
    const automaton = useAutomatonStore();
    const s0 = automaton.addState({ x: 0, y: 0 });
    const s1 = automaton.addState({ x: 100, y: 0 });
    automaton.updateState(s1.id, { isAccept: true });
    automaton.addTransition(s0.id, s1.id, "a");

    const { sim, setInput, step, reset } = useSimulation();
    setInput("a");
    step();
    reset();
    expect(sim.status).toBe(SimulationStatus.Idle);
  });
});
