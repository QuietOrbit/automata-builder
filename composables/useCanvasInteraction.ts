import { reactive, computed, type Ref } from "vue";
import type { Position } from "~/types/automaton";
import type { StateVisualInfo } from "~/utils/canvas/collision";
import { computeStateBounds } from "~/utils/canvas/collision";

/** Minimum zoom level (fully zoomed out). */
export const MIN_ZOOM = 0.2;
/** Maximum zoom level (fully zoomed in). */
export const MAX_ZOOM = 5;
/** Multiplier applied to wheel deltaY to control zoom speed. */
const ZOOM_SENSITIVITY = 0.001;
/** Multiplier per zoom button click (industry standard — Figma, Google Maps). */
const ZOOM_STEP = 1.25;

/**
 * Composable for SVG canvas pan and zoom interaction.
 * Manages the viewBox, converts screen coordinates to canvas (world) coordinates,
 * and handles pointer-based panning and wheel-based zooming.
 *
 * @param svgRef - Reactive reference to the SVG element.
 * @returns Reactive pan/zoom state and event handlers for binding to SVG events.
 */
export function useCanvasInteraction(svgRef: Ref<SVGSVGElement | null>) {
  /** Current pan offset in world coordinates. */
  const pan = reactive({ x: -400, y: -300 });
  /** Current zoom factor (1 = 100%). */
  const zoom = ref(1);

  const isPanning = ref(false);
  /** Screen-space position where the current pan gesture started. */
  const panStart = reactive({ x: 0, y: 0 });

  /** Computed SVG viewBox string derived from pan, zoom, and element dimensions. */
  const viewBox = computed(() => {
    const svgEl = svgRef.value;
    if (!svgEl) return "0 0 800 600";
    const rect = svgEl.getBoundingClientRect();
    const w = rect.width / zoom.value;
    const h = rect.height / zoom.value;
    return `${pan.x} ${pan.y} ${w} ${h}`;
  });

  /**
   * Convert screen (client) coordinates to world (SVG canvas) coordinates.
   * @param screenX - Client X position (e.g. from a PointerEvent).
   * @param screenY - Client Y position.
   * @returns The corresponding position in SVG world space.
   */
  function screenToWorld(screenX: number, screenY: number): Position {
    const svgEl = svgRef.value;
    if (!svgEl) return { x: screenX, y: screenY };
    const rect = svgEl.getBoundingClientRect();
    return {
      x: (screenX - rect.left) / zoom.value + pan.x,
      y: (screenY - rect.top) / zoom.value + pan.y,
    };
  }

  /**
   * Convert world (SVG canvas) coordinates to screen (client) coordinates.
   * Inverse of {@link screenToWorld}.
   * @param worldX - X position in SVG world space.
   * @param worldY - Y position in SVG world space.
   * @returns The corresponding position in client (screen) space.
   */
  function worldToScreen(worldX: number, worldY: number): Position {
    const svgEl = svgRef.value;
    if (!svgEl) return { x: worldX, y: worldY };
    const rect = svgEl.getBoundingClientRect();
    return {
      x: (worldX - pan.x) * zoom.value + rect.left,
      y: (worldY - pan.y) * zoom.value + rect.top,
    };
  }

  /**
   * Handle mouse wheel events for zooming. Zooms toward the cursor position
   * so the point under the cursor stays fixed.
   */
  function onWheel(event: WheelEvent) {
    event.preventDefault();

    const svgEl = svgRef.value;
    if (!svgEl) return;

    // Get cursor position in world coords before zoom
    const worldBefore = screenToWorld(event.clientX, event.clientY);

    // Apply zoom
    const delta = -event.deltaY * ZOOM_SENSITIVITY;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value * (1 + delta)));
    zoom.value = newZoom;

    // Adjust pan so cursor stays over the same world point
    const rect = svgEl.getBoundingClientRect();
    pan.x = worldBefore.x - (event.clientX - rect.left) / newZoom;
    pan.y = worldBefore.y - (event.clientY - rect.top) / newZoom;
  }

  /**
   * Begin a pan gesture from a pointer event.
   * @param event - The initiating pointer event (typically pointerdown on the canvas background).
   */
  function onPanStart(event: PointerEvent) {
    isPanning.value = true;
    panStart.x = event.clientX;
    panStart.y = event.clientY;
  }

  /**
   * Continue a pan gesture by updating the pan offset from pointer movement.
   * Movement is scaled by the inverse of the current zoom level.
   */
  function onPanMove(event: PointerEvent) {
    if (!isPanning.value) return;
    const dx = (event.clientX - panStart.x) / zoom.value;
    const dy = (event.clientY - panStart.y) / zoom.value;
    pan.x -= dx;
    pan.y -= dy;
    panStart.x = event.clientX;
    panStart.y = event.clientY;
  }

  /** End the current pan gesture. */
  function onPanEnd() {
    isPanning.value = false;
  }

  /**
   * Pan and zoom so that all states (with their visual extras) fit inside
   * the viewport with some padding.
   *
   * @param visualInfos - Visual info for every state in the automaton.
   * @param padding     - World-unit margin around the content bounding box.
   */
  function fitToContent(visualInfos: StateVisualInfo[], padding = 50) {
    const svgEl = svgRef.value;
    if (!svgEl || visualInfos.length === 0) return;

    // Compute union AABB of all states
    let unionMinX = Infinity;
    let unionMinY = Infinity;
    let unionMaxX = -Infinity;
    let unionMaxY = -Infinity;
    for (const info of visualInfos) {
      const bounds = computeStateBounds(info);
      if (bounds.minX < unionMinX) unionMinX = bounds.minX;
      if (bounds.minY < unionMinY) unionMinY = bounds.minY;
      if (bounds.maxX > unionMaxX) unionMaxX = bounds.maxX;
      if (bounds.maxY > unionMaxY) unionMaxY = bounds.maxY;
    }

    // Add padding
    unionMinX -= padding;
    unionMinY -= padding;
    unionMaxX += padding;
    unionMaxY += padding;

    const contentWidth = unionMaxX - unionMinX;
    const contentHeight = unionMaxY - unionMinY;
    if (contentWidth <= 0 || contentHeight <= 0) return;

    const rect = svgEl.getBoundingClientRect();
    const optimalZoom = Math.min(rect.width / contentWidth, rect.height / contentHeight);
    zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, optimalZoom));

    // Center the content AABB in the viewport
    const centerX = (unionMinX + unionMaxX) / 2;
    const centerY = (unionMinY + unionMaxY) / 2;
    pan.x = centerX - (rect.width / zoom.value) / 2;
    pan.y = centerY - (rect.height / zoom.value) / 2;
  }

  /**
   * Zoom to a target level, keeping the viewport center fixed in world space.
   * Used by button-based zoom (unlike wheel zoom which centers on cursor).
   */
  function zoomToCenter(targetZoom: number) {
    const svgEl = svgRef.value;
    if (!svgEl) return;

    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
    const rect = svgEl.getBoundingClientRect();

    // Current viewport center in world coords
    const centerX = pan.x + (rect.width / zoom.value) / 2;
    const centerY = pan.y + (rect.height / zoom.value) / 2;

    zoom.value = clamped;

    // Adjust pan so the same world point stays at viewport center
    pan.x = centerX - (rect.width / clamped) / 2;
    pan.y = centerY - (rect.height / clamped) / 2;
  }

  /** Zoom in by one step (1.25x). */
  function zoomIn() {
    zoomToCenter(zoom.value * ZOOM_STEP);
  }

  /** Zoom out by one step (÷1.25). */
  function zoomOut() {
    zoomToCenter(zoom.value / ZOOM_STEP);
  }

  /** Reset zoom to 100%. */
  function resetZoom() {
    zoomToCenter(1);
  }

  return {
    pan,
    zoom,
    viewBox,
    isPanning,
    screenToWorld,
    worldToScreen,
    onWheel,
    onPanStart,
    onPanMove,
    onPanEnd,
    fitToContent,
    zoomIn,
    zoomOut,
    resetZoom,
  };
}
