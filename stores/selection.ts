import { defineStore } from 'pinia'

/** Internal state for the selection store. */
interface SelectionState {
  /** ID of the currently selected state node, or null if none. */
  selectedStateId: string | null
  /** ID of the currently selected transition arrow, or null if none. */
  selectedTransitionId: string | null
}

/**
 * Tracks which single entity (state or transition) is currently selected in the UI.
 * Selection is mutually exclusive — selecting a state clears any transition selection and vice versa.
 */
export const useSelectionStore = defineStore('selection', {
  state: (): SelectionState => ({
    selectedStateId: null,
    selectedTransitionId: null,
  }),

  actions: {
    /**
     * Select a state node, clearing any previous selection.
     * @param id - ID of the state to select.
     */
    selectState(id: string) {
      this.selectedStateId = id
      this.selectedTransitionId = null
    },

    /** Clear all selections, returning to the default (nothing selected) state. */
    clearSelection() {
      this.selectedStateId = null
      this.selectedTransitionId = null
    },
  },
})
