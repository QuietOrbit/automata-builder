import { defineStore } from 'pinia'

interface SelectionState {
  selectedStateId: string | null
  selectedTransitionId: string | null
}

export const useSelectionStore = defineStore('selection', {
  state: (): SelectionState => ({
    selectedStateId: null,
    selectedTransitionId: null,
  }),

  actions: {
    selectState(id: string) {
      this.selectedStateId = id
      this.selectedTransitionId = null
    },

    clearSelection() {
      this.selectedStateId = null
      this.selectedTransitionId = null
    },
  },
})
