import type { OptimizerRun, PassageDefinition, WorkspaceData } from "../types";

export async function loadBundledWorkspace(): Promise<WorkspaceData> {
  const response = await fetch("./data/quadrotor-workspace.json");
  if (!response.ok) throw new Error(`Could not load bundled workspace (${response.status})`);
  return response.json() as Promise<WorkspaceData>;
}

export function normaliseImportedTrace(value: unknown, filename: string): WorkspaceData {
  if (!value || typeof value !== "object") throw new Error("The selected file is not a valid trace.");
  const candidate = value as Partial<WorkspaceData> & Partial<OptimizerRun>;
  if (Array.isArray(candidate.runs) && Array.isArray(candidate.passages)) return candidate as WorkspaceData;
  if (!Array.isArray(candidate.trace) || typeof candidate.optimizer !== "string") {
    throw new Error("Expected an Optimiser Visual Editor workspace or an optimiser run JSON file.");
  }

  const native = candidate.trace.at(-1)?.native_after ?? [];
  const horizon = Math.max(1, Math.floor(native.length / 2));
  const passageId = candidate.passage || "imported_passage";
  const passage: PassageDefinition = {
    id: passageId,
    label: "Imported passage",
    purpose: `Imported from ${filename.split(/[\\/]/).at(-1)}`,
    horizon,
    dt: 0.05,
    initial_state: [0, 0, 0, 0, 0, 0],
    target_state: [0, 0, 0, 0, 0, 0],
  };
  const run = candidate as OptimizerRun;
  run.id = run.id || `${passageId}__${run.representation || "native"}__${run.optimizer}`;
  run.passage = passageId;
  return {
    schema_version: "0.1-imported",
    name: filename.split(/[\\/]/).at(-1) || "Imported trace",
    created_at: new Date().toISOString(),
    source: filename,
    passages: [passage],
    runs: [run],
  };
}
