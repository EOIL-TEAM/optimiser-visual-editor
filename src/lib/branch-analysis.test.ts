import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { BranchAnalysisWorkspace } from "../types";

const workspace = JSON.parse(
  readFileSync(new URL("../../public/data/branch-analyses.json", import.meta.url), "utf8"),
) as BranchAnalysisWorkspace;

function known(iteration: number) {
  return workspace.analyses.find((item) =>
    item.passage === "short_aggressive" &&
    item.representation === "native" &&
    item.election_iteration === iteration
  )!;
}

describe("genuine-kernel branch evidence", () => {
  it("covers every recorded SORF election with seven continuations", () => {
    expect(workspace.analyses).toHaveLength(73);
    expect(workspace.analyses.every((analysis) => analysis.branches.length === 7)).toBe(true);
    expect(workspace.analyses.every((analysis) => analysis.reproduction.passed)).toBe(true);
  });

  it("reproduces the known surviving and failed elections", () => {
    expect(known(3).outcome).toBe("survived_next_extension");
    expect(known(3).reproduction.maximum_value_residual).toBe(0);
    expect(known(44).outcome).toBe("failed_next_extension");
    expect(known(44).reproduction.maximum_value_residual).toBe(0);
  });

  it("isolates the iteration 44 scale-versus-resolution mechanism", () => {
    const branches = known(44).branches;
    const elected = branches.find((item) => item.id === "elected")!;
    const parent = branches.find((item) => item.id === "parent")!;
    expect(elected.direction.directional_derivative).toBeLessThan(0);
    expect(elected.direction.operative_norm / parent.direction.operative_norm).toBeGreaterThan(9_000);
    expect(elected.immediate.first_improving_exponent).toBe(20);
    expect(elected.immediate.adopted).toBe(false);
    expect(parent.immediate.first_improving_exponent).toBe(7);
    expect(parent.immediate.adopted).toBe(true);
  });
});
