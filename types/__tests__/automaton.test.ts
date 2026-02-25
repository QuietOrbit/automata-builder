import { describe, expect, it } from "vitest";
import { AutomatonType, EPSILON, SimulationStatus } from "../automaton";

describe("types/automaton", () => {
  describe("EPSILON constant", () => {
    it("equals the Unicode epsilon character", () => {
      expect(EPSILON).toBe("ε");
    });
  });

  describe("AutomatonType enum", () => {
    it("has DFA and NFA values", () => {
      expect(AutomatonType.DFA).toBe("DFA");
      expect(AutomatonType.NFA).toBe("NFA");
    });

    it("has exactly 2 members", () => {
      const values = Object.values(AutomatonType);
      expect(values).toHaveLength(2);
    });
  });

  describe("SimulationStatus enum", () => {
    it("has all expected status values", () => {
      expect(SimulationStatus.Idle).toBe("idle");
      expect(SimulationStatus.Running).toBe("running");
      expect(SimulationStatus.Accepted).toBe("accepted");
      expect(SimulationStatus.Rejected).toBe("rejected");
      expect(SimulationStatus.Stuck).toBe("stuck");
    });

    it("has exactly 5 members", () => {
      const values = Object.values(SimulationStatus);
      expect(values).toHaveLength(5);
    });
  });
});
