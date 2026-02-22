import { describe, expect, it, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useTransitionRouting } from "./useTransitionRouting";
import { useAutomatonStore } from "~/stores/automaton";

describe("composables/useTransitionRouting", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("returns null for a transition with missing source", () => {
    useAutomatonStore();
    const { getTransitionPath } = useTransitionRouting();
    const result = getTransitionPath({
      id: "t1",
      sourceId: "nonexistent",
      targetId: "nonexistent",
      symbol: "a",
    });
    expect(result).toBeNull();
  });

  it("returns a self-loop path for a self-transition", () => {
    const automaton = useAutomatonStore();
    const s0 = automaton.addState({ x: 100, y: 100 });
    automaton.addTransition(s0.id, s0.id, "a");

    const { getTransitionPath } = useTransitionRouting();
    const result = getTransitionPath(automaton.transitions[0]);
    expect(result).not.toBeNull();
    expect(result!.path).toContain("A "); // arc command for self-loop
  });

  it("returns a straight path for a unidirectional transition", () => {
    const automaton = useAutomatonStore();
    const s0 = automaton.addState({ x: 0, y: 0 });
    const s1 = automaton.addState({ x: 200, y: 0 });
    automaton.addTransition(s0.id, s1.id, "a");

    const { getTransitionPath } = useTransitionRouting();
    const result = getTransitionPath(automaton.transitions[0]);
    expect(result).not.toBeNull();
    expect(result!.path).toMatch(/^M .+ L .+$/); // straight line
  });

  it("returns a curved path for bidirectional transitions", () => {
    const automaton = useAutomatonStore();
    const s0 = automaton.addState({ x: 0, y: 0 });
    const s1 = automaton.addState({ x: 200, y: 0 });
    automaton.addTransition(s0.id, s1.id, "a");
    automaton.addTransition(s1.id, s0.id, "b");

    const { getTransitionPath } = useTransitionRouting();
    const forward = getTransitionPath(automaton.transitions[0]);
    expect(forward).not.toBeNull();
    expect(forward!.path).toMatch(/^M .+ Q .+$/); // quadratic curve
  });
});
