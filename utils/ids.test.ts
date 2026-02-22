import { describe, expect, it } from "vitest";
import { createId } from "./ids";

describe("utils/ids", () => {
  describe("createId", () => {
    it("returns a 10-character string", () => {
      const id = createId();
      expect(id).toHaveLength(10);
      expect(typeof id).toBe("string");
    });

    it("generates unique IDs across multiple calls", () => {
      const ids = new Set(Array.from({ length: 100 }, () => createId()));
      expect(ids.size).toBe(100);
    });

    it("returns URL-safe characters only", () => {
      const id = createId();
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });
});
