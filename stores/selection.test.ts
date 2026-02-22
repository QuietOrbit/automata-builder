import { describe, expect, it, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSelectionStore } from "./selection";

describe("stores/selection", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("initial state", () => {
    it("has no selection and no pins", () => {
      const store = useSelectionStore();
      expect(store.selectedStateId).toBeNull();
      expect(store.selectedTransitionId).toBeNull();
      expect(store.pinnedStateIds).toEqual([]);
    });
  });

  describe("selectState", () => {
    it("selects a state by ID", () => {
      const store = useSelectionStore();
      store.selectState("s1");
      expect(store.selectedStateId).toBe("s1");
    });

    it("clears transition selection when selecting a state", () => {
      const store = useSelectionStore();
      store.selectedTransitionId = "t1";
      store.selectState("s1");
      expect(store.selectedTransitionId).toBeNull();
    });

    it("replaces previous state selection", () => {
      const store = useSelectionStore();
      store.selectState("s1");
      store.selectState("s2");
      expect(store.selectedStateId).toBe("s2");
    });
  });

  describe("clearSelection", () => {
    it("clears both state and transition selection", () => {
      const store = useSelectionStore();
      store.selectState("s1");
      store.selectedTransitionId = "t1";
      store.clearSelection();
      expect(store.selectedStateId).toBeNull();
      expect(store.selectedTransitionId).toBeNull();
    });

    it("does not clear pinned states", () => {
      const store = useSelectionStore();
      store.pinState("s1");
      store.clearSelection();
      expect(store.pinnedStateIds).toEqual(["s1"]);
    });
  });

  describe("closeAll", () => {
    it("clears selection and all pins", () => {
      const store = useSelectionStore();
      store.selectState("s1");
      store.pinState("s2");
      store.pinState("s3");
      store.closeAll();
      expect(store.selectedStateId).toBeNull();
      expect(store.selectedTransitionId).toBeNull();
      expect(store.pinnedStateIds).toEqual([]);
    });
  });

  describe("pinState / unpinState", () => {
    it("adds a state to the pinned set", () => {
      const store = useSelectionStore();
      store.pinState("s1");
      expect(store.pinnedStateIds).toContain("s1");
    });

    it("does not duplicate pins", () => {
      const store = useSelectionStore();
      store.pinState("s1");
      store.pinState("s1");
      expect(store.pinnedStateIds).toEqual(["s1"]);
    });

    it("removes a state from the pinned set", () => {
      const store = useSelectionStore();
      store.pinState("s1");
      store.pinState("s2");
      store.unpinState("s1");
      expect(store.pinnedStateIds).toEqual(["s2"]);
    });
  });

  describe("togglePin", () => {
    it("pins an unpinned state", () => {
      const store = useSelectionStore();
      store.togglePin("s1");
      expect(store.pinnedStateIds).toContain("s1");
    });

    it("unpins a pinned state", () => {
      const store = useSelectionStore();
      store.pinState("s1");
      store.togglePin("s1");
      expect(store.pinnedStateIds).not.toContain("s1");
    });

    it("uses selectedStateId when no ID is provided", () => {
      const store = useSelectionStore();
      store.selectState("s1");
      store.togglePin();
      expect(store.pinnedStateIds).toContain("s1");
    });

    it("does nothing when no ID provided and no selection", () => {
      const store = useSelectionStore();
      store.togglePin();
      expect(store.pinnedStateIds).toEqual([]);
    });
  });

  describe("isStatePinned", () => {
    it("returns true for pinned states", () => {
      const store = useSelectionStore();
      store.pinState("s1");
      expect(store.isStatePinned("s1")).toBe(true);
    });

    it("returns false for unpinned states", () => {
      const store = useSelectionStore();
      expect(store.isStatePinned("s1")).toBe(false);
    });
  });
});
