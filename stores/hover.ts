import { defineStore } from "pinia";

/** Internal state for the hover store. */
interface HoverState {
  /** ID of the state node currently being hovered, or null if none. */
  hoveredStateId: string | null;
}

/**
 * Tracks which state node is currently hovered on the canvas.
 * Used to highlight potential transition targets when editing a selected state.
 */
export const useHoverStore = defineStore("hover", {
  state: (): HoverState => ({
    hoveredStateId: null,
  }),

  actions: {
    /**
     * Set the currently hovered state.
     * @param id - ID of the state being hovered.
     */
    setHoveredState(id: string) {
      this.hoveredStateId = id;
    },

    /** Clear the hovered state. */
    clearHoveredState() {
      this.hoveredStateId = null;
    },
  },
});
