import { defineStore } from 'pinia'

/**
 * Lightweight signaling store to bridge sidebar components (TupleBuilder)
 * with the canvas (SvgCanvas) for fit-to-content requests.
 *
 * The counter-based approach avoids timing issues — the canvas watches the
 * counter and reacts whenever it increments, regardless of when the watcher
 * fires.
 */
export const useViewportStore = defineStore('viewport', {
  state: () => ({
    /** Monotonically increasing counter; each increment triggers a fit-to-content. */
    fitRequestId: 0,
  }),

  actions: {
    /** Signal that the canvas should re-center and zoom to fit all content. */
    requestFitToContent() {
      this.fitRequestId++
    },
  },
})
