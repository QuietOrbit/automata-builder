import { describe, expect, it, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useViewportStore } from "./viewport";

describe("stores/viewport", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with fitRequestId at 0", () => {
    const store = useViewportStore();
    expect(store.fitRequestId).toBe(0);
  });

  it("increments fitRequestId on each requestFitToContent call", () => {
    const store = useViewportStore();
    store.requestFitToContent();
    expect(store.fitRequestId).toBe(1);
    store.requestFitToContent();
    expect(store.fitRequestId).toBe(2);
  });
});
