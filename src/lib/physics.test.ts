import { describe, expect, it } from "vitest";
import { objectiveBreakdown, simulatePassage } from "./physics";
import type { PassageDefinition } from "../types";

const shortAggressive: PassageDefinition = {
  id: "short_aggressive",
  label: "Short aggressive",
  purpose: "test fixture",
  horizon: 40,
  dt: 0.05,
  initial_state: [0, 0, 0, 0, 0, 0],
  target_state: [1.5, 1.5, 0, 0, 0, 0],
};

describe("quadrotor reconstruction", () => {
  it("keeps the initial hover programme stationary", () => {
    const samples = simulatePassage(new Array(80).fill(0), shortAggressive);
    expect(samples).toHaveLength(41);
    expect(samples.at(-1)?.x).toBeCloseTo(0, 12);
    expect(samples.at(-1)?.z).toBeCloseTo(0, 12);
    expect(samples.at(-1)?.pitch).toBeCloseTo(0, 12);
  });

  it("reconstructs the declared initial objective", () => {
    const controls = new Array(80).fill(0);
    const samples = simulatePassage(controls, shortAggressive);
    const breakdown = objectiveBreakdown(controls, shortAggressive, samples);
    expect(breakdown.total).toBeCloseTo(63.45, 10);
    expect(breakdown.actuator).toBe(0);
  });
});
