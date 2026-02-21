import { defineStore } from "pinia";
import { useHoverStore } from "~/stores/hover";

/** Internal state for the selection store. */
interface SelectionState {
  /** ID of the currently selected state node, or null if none. */
  selectedStateId: string | null;
  /** ID of the currently selected transition arrow, or null if none. */
  selectedTransitionId: string | null;
  /** IDs of states whose bubble editors are pinned open. */
  pinnedStateIds: string[];
}

/**
 * Tracks which single entity (state or transition) is currently selected in the UI.
 * Selection is mutually exclusive — selecting a state clears any transition selection and vice versa.
 * Pinned states maintain their bubble editors independently of the active selection.
 */
export const useSelectionStore = defineStore("selection", {
  state: (): SelectionState => ({
    selectedStateId: null,
    selectedTransitionId: null,
    pinnedStateIds: [],
  }),

  actions: {
    /**
     * Select a state node, clearing any previous selection.
     * @param id - ID of the state to select.
     */
    selectState(id: string) {
      this.selectedStateId = id;
      this.selectedTransitionId = null;
      useHoverStore().clearHoveredState();
    },

    /**
     * Clear the active selection. Pinned states are NOT affected.
     * Use {@link closeAll} to also clear pinned states.
     */
    clearSelection() {
      this.selectedStateId = null;
      this.selectedTransitionId = null;
      useHoverStore().clearHoveredState();
    },

    /** Close all bubbles — clears active selection and unpins everything. */
    closeAll() {
      this.selectedStateId = null;
      this.selectedTransitionId = null;
      this.pinnedStateIds = [];
      useHoverStore().clearHoveredState();
    },

    /**
     * Add a state to the pinned set.
     * @param id - State ID to pin.
     */
    pinState(id: string) {
      if (!this.pinnedStateIds.includes(id)) {
        this.pinnedStateIds.push(id);
      }
    },

    /**
     * Remove a state from the pinned set.
     * @param id - State ID to unpin.
     */
    unpinState(id: string) {
      this.pinnedStateIds = this.pinnedStateIds.filter(pid => pid !== id);
    },

    /**
     * Toggle pin status for a state. Defaults to the currently selected state.
     * @param id - State ID to toggle, or undefined to use selectedStateId.
     */
    togglePin(id?: string) {
      const target = id ?? this.selectedStateId;
      if (!target) return;
      if (this.pinnedStateIds.includes(target)) {
        this.unpinState(target);
      }
      else {
        this.pinState(target);
      }
    },

    /**
     * Check if a state is pinned.
     * @param id - State ID to check.
     */
    isStatePinned(id: string): boolean {
      return this.pinnedStateIds.includes(id);
    },
  },
});
