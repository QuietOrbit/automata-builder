import { describe, expect, it, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useViewportStore } from "../viewport";

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

  it("starts with isFullscreen as false", () => {
    const store = useViewportStore();
    expect(store.isFullscreen).toBe(false);
  });

  it("toggleFullscreen flips the boolean", () => {
    const store = useViewportStore();
    store.toggleFullscreen();
    expect(store.isFullscreen).toBe(true);
    store.toggleFullscreen();
    expect(store.isFullscreen).toBe(false);
  });

  it("exitFullscreen sets to false", () => {
    const store = useViewportStore();
    store.toggleFullscreen();
    expect(store.isFullscreen).toBe(true);
    store.exitFullscreen();
    expect(store.isFullscreen).toBe(false);
  });

  it("exitFullscreen is a no-op when already false", () => {
    const store = useViewportStore();
    expect(store.isFullscreen).toBe(false);
    store.exitFullscreen();
    expect(store.isFullscreen).toBe(false);
  });
});
