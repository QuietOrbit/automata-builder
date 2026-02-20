import { defineStore } from 'pinia'
import type { StateId, TransitionId } from '~/types/automaton'

interface SelectionState {
  selectedStateId: StateId | null
  selectedTransitionId: TransitionId | null
}

export const useSelectionStore = defineStore('selection', {
  state: (): SelectionState => ({
    selectedStateId: null,
    selectedTransitionId: null,
  }),

  actions: {
    selectState(id: StateId) {
      this.selectedStateId = id
      this.selectedTransitionId = null
    },

    selectTransition(id: TransitionId) {
      this.selectedTransitionId = id
      this.selectedStateId = null
    },

    clearSelection() {
      this.selectedStateId = null
      this.selectedTransitionId = null
    },
  },
})
