import { defineStore } from "pinia";

/**
 * Lightweight signaling store to bridge sidebar components (TupleBuilder)
 * with the canvas (SvgCanvas) for fit-to-content requests.
 *
 * The counter-based approach avoids timing issues — the canvas watches the
 * counter and reacts whenever it increments, regardless of when the watcher
 * fires.
 */
export const useViewportStore = defineStore("viewport", {
  state: () => ({
    /** Monotonically increasing counter; each increment triggers a fit-to-content. */
    fitRequestId: 0,
    /** Whether the canvas is in fullscreen mode (side panel hidden). */
    isFullscreen: false,
    /** Current pan X offset in world coordinates (synced from canvas composable). */
    panX: 0,
    /** Current pan Y offset in world coordinates (synced from canvas composable). */
    panY: 0,
    /** Current zoom level (synced from canvas composable). */
    zoom: 1,
    /** Monotonically increasing counter; each increment triggers a viewport restore. */
    viewportRestoreId: 0,
  }),

  actions: {
    /** Signal that the canvas should re-center and zoom to fit all content. */
    requestFitToContent() {
      this.fitRequestId++;
    },
    /** Toggle fullscreen mode on or off. */
    toggleFullscreen() {
      this.isFullscreen = !this.isFullscreen;
    },
    /** Exit fullscreen mode (no-op if already not fullscreen). */
    exitFullscreen() {
      this.isFullscreen = false;
    },
    /** Sync the viewport pan/zoom from the canvas composable. */
    syncViewport(panX: number, panY: number, zoom: number) {
      this.panX = panX;
      this.panY = panY;
      this.zoom = zoom;
    },
    /** Signal that imported viewport data should be applied to the canvas. */
    requestViewportRestore() {
      this.viewportRestoreId++;
    },
  },
});
