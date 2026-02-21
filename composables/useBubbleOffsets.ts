import { reactive } from "vue";

/**
 * Session-scoped position memory for bubble editors.
 * Stores per-state drag offsets so reopening a bubble restores its last position.
 * Resets on page reload (no localStorage persistence).
 */
const offsets = reactive(new Map<string, { x: number; y: number }>());

/** Get the stored drag offset for a state, or {0, 0} if none. */
export function getBubbleOffset(stateId: string): { x: number; y: number } {
  return offsets.get(stateId) ?? { x: 0, y: 0 };
}

/** Store the drag offset for a state. */
export function setBubbleOffset(stateId: string, x: number, y: number) {
  offsets.set(stateId, { x, y });
}
