import { defineStore } from "pinia";

/** Sidebar tab identifiers. */
export enum SidebarTab {
  Build = "build",
  Transform = "transform",
  Simulate = "simulate",
}

const STORAGE_KEY = "automata-sidebar";

/** Default state when no localStorage entry exists. */
function defaultState() {
  return {
    activeTab: SidebarTab.Build as SidebarTab,
    collapsedSections: new Set<string>(),
  };
}

/** Read persisted sidebar state from localStorage. */
function loadFromStorage(): ReturnType<typeof defaultState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      activeTab: Object.values(SidebarTab).includes(parsed.activeTab)
        ? parsed.activeTab
        : SidebarTab.Build,
      collapsedSections: new Set<string>(
        Array.isArray(parsed.collapsedSections) ? parsed.collapsedSections : [],
      ),
    };
  }
  catch {
    return defaultState();
  }
}

/**
 * Store for sidebar UI state: active tab and collapsed sections.
 * Persists to localStorage so the layout survives page reloads.
 */
export const useSidebarStore = defineStore("sidebar", {
  state: () => loadFromStorage(),

  getters: {
    /** Check whether a section is currently collapsed. */
    isSectionCollapsed: state => (sectionId: string) => state.collapsedSections.has(sectionId),
  },

  actions: {
    /** Switch the active sidebar tab. */
    setTab(tab: SidebarTab) {
      this.activeTab = tab;
      this.persist();
    },

    /** Toggle a section between collapsed and expanded. */
    toggleSection(sectionId: string) {
      if (this.collapsedSections.has(sectionId)) {
        this.collapsedSections.delete(sectionId);
      }
      else {
        this.collapsedSections.add(sectionId);
      }
      this.persist();
    },

    /** Programmatically expand a section (no-op if already expanded). */
    expandSection(sectionId: string) {
      if (this.collapsedSections.has(sectionId)) {
        this.collapsedSections.delete(sectionId);
        this.persist();
      }
    },

    /** Write current state to localStorage. */
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          activeTab: this.activeTab,
          collapsedSections: [...this.collapsedSections],
        }));
      }
      catch {
        // localStorage may be full or unavailable — silently ignore
      }
    },
  },
});
