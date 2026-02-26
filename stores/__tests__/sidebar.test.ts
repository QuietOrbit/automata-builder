import { describe, expect, it, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSidebarStore, SidebarTab } from "../sidebar";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("stores/sidebar", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("starts with Build tab active", () => {
    const store = useSidebarStore();
    expect(store.activeTab).toBe(SidebarTab.Build);
  });

  it("starts with no collapsed sections", () => {
    const store = useSidebarStore();
    expect(store.collapsedSections.size).toBe(0);
  });

  it("setTab changes the active tab", () => {
    const store = useSidebarStore();
    store.setTab(SidebarTab.Simulate);
    expect(store.activeTab).toBe(SidebarTab.Simulate);
  });

  it("toggleSection adds and removes section IDs", () => {
    const store = useSidebarStore();
    store.toggleSection("build:regex");
    expect(store.collapsedSections.has("build:regex")).toBe(true);
    store.toggleSection("build:regex");
    expect(store.collapsedSections.has("build:regex")).toBe(false);
  });

  it("isSectionCollapsed returns correct state", () => {
    const store = useSidebarStore();
    expect(store.isSectionCollapsed("build:regex")).toBe(false);
    store.toggleSection("build:regex");
    expect(store.isSectionCollapsed("build:regex")).toBe(true);
  });

  it("expandSection removes from collapsed set", () => {
    const store = useSidebarStore();
    store.toggleSection("build:regex");
    expect(store.isSectionCollapsed("build:regex")).toBe(true);
    store.expandSection("build:regex");
    expect(store.isSectionCollapsed("build:regex")).toBe(false);
  });

  it("expandSection is a no-op when already expanded", () => {
    const store = useSidebarStore();
    store.expandSection("build:regex");
    expect(store.isSectionCollapsed("build:regex")).toBe(false);
  });

  it("persists activeTab to localStorage", () => {
    const store = useSidebarStore();
    store.setTab(SidebarTab.Transform);
    expect(localStorageMock.setItem).toHaveBeenCalled();
    const saved = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)![1]);
    expect(saved.activeTab).toBe(SidebarTab.Transform);
  });

  it("persists collapsedSections to localStorage", () => {
    const store = useSidebarStore();
    store.toggleSection("build:tuple");
    const saved = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)![1]);
    expect(saved.collapsedSections).toContain("build:tuple");
  });

  it("restores state from localStorage on init", () => {
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
      activeTab: SidebarTab.Simulate,
      collapsedSections: ["build:regex", "build:tuple"],
    }));
    const store = useSidebarStore();
    expect(store.activeTab).toBe(SidebarTab.Simulate);
    expect(store.collapsedSections.has("build:regex")).toBe(true);
    expect(store.collapsedSections.has("build:tuple")).toBe(true);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorageMock.getItem.mockReturnValueOnce("not-valid-json");
    const store = useSidebarStore();
    expect(store.activeTab).toBe(SidebarTab.Build);
    expect(store.collapsedSections.size).toBe(0);
  });
});
