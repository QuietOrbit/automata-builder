import { describe, expect, it, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useHoverStore } from "./hover";

describe("stores/hover", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with no hovered state", () => {
    const store = useHoverStore();
    expect(store.hoveredStateId).toBeNull();
  });

  it("sets hovered state", () => {
    const store = useHoverStore();
    store.setHoveredState("s1");
    expect(store.hoveredStateId).toBe("s1");
  });

  it("clears hovered state", () => {
    const store = useHoverStore();
    store.setHoveredState("s1");
    store.clearHoveredState();
    expect(store.hoveredStateId).toBeNull();
  });

  it("replaces hovered state on successive calls", () => {
    const store = useHoverStore();
    store.setHoveredState("s1");
    store.setHoveredState("s2");
    expect(store.hoveredStateId).toBe("s2");
  });
});
