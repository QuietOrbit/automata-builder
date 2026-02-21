import { nanoid } from "nanoid";

/**
 * Generate a short, URL-safe unique identifier for automaton entities.
 * @returns A 10-character nanoid string.
 */
export function createId(): string {
  return nanoid(10);
}
