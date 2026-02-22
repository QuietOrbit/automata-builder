import { describe, expect, it } from "vitest";
import { computeContentBounds } from "./export";

describe("utils/export", () => {
  describe("computeContentBounds", () => {
    it("returns null for empty positions array", () => {
      expect(computeContentBounds([])).toBeNull();
    });

    it("computes bounds around a single position with default padding", () => {
      const result = computeContentBounds([{ x: 100, y: 200 }]);
      expect(result).toEqual({
        x: 100 - 80,
        y: 200 - 80,
        width: 160,
        height: 160,
      });
    });

    it("computes bounds around multiple positions", () => {
      const result = computeContentBounds([
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ]);
      expect(result).toEqual({
        x: -80,
        y: -80,
        width: 260,
        height: 210,
      });
    });

    it("respects custom padding", () => {
      const result = computeContentBounds([{ x: 50, y: 50 }], 20);
      expect(result).toEqual({
        x: 30,
        y: 30,
        width: 40,
        height: 40,
      });
    });

    it("handles negative coordinates", () => {
      const result = computeContentBounds([
        { x: -100, y: -200 },
        { x: 100, y: 200 },
      ]);
      expect(result).toEqual({
        x: -180,
        y: -280,
        width: 360,
        height: 560,
      });
    });
  });
});
