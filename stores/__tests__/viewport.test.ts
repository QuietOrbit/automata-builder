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

  it("starts with default viewport values", () => {
    const store = useViewportStore();
    expect(store.panX).toBe(0);
    expect(store.panY).toBe(0);
    expect(store.zoom).toBe(1);
  });

  it("syncViewport updates pan and zoom", () => {
    const store = useViewportStore();
    store.syncViewport(-200, -150, 1.5);
    expect(store.panX).toBe(-200);
    expect(store.panY).toBe(-150);
    expect(store.zoom).toBe(1.5);
  });

  it("starts with viewportRestoreId at 0", () => {
    const store = useViewportStore();
    expect(store.viewportRestoreId).toBe(0);
  });

  it("requestViewportRestore increments the counter", () => {
    const store = useViewportStore();
    store.requestViewportRestore();
    expect(store.viewportRestoreId).toBe(1);
    store.requestViewportRestore();
    expect(store.viewportRestoreId).toBe(2);
  });
});
