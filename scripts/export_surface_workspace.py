from __future__ import annotations

import json
import argparse
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXPERIMENT_ROOT = ROOT.parent / "arena-sorf-quadrotor" / "ARENA_QUADROTOR_EXPERIMENT"
DEFAULT_TARGET = ROOT / "public" / "data" / "surface-workspace.json"

parser = argparse.ArgumentParser()
parser.add_argument("--experiment-root", type=Path, default=DEFAULT_EXPERIMENT_ROOT)
parser.add_argument("--output", type=Path, default=DEFAULT_TARGET)
args = parser.parse_args()
SOURCE = args.experiment_root.resolve() / "experiments" / "projective_sorf_real_benchmarks" / "results" / "surfaces" / "runs.json"
TARGET = args.output

if not SOURCE.exists():
    raise SystemExit(f"Missing {SOURCE}; run the frozen real surface benchmark first.")

runs = json.loads(SOURCE.read_text())
selected = [
    run for run in runs
    if run["problem"] == "quadratic" or (run["problem"] == "rastrigin" and run["start_index"] == 0)
]
for run in selected:
    passage = f"surface_{run.pop('problem')}"
    run.pop("start", None)
    run.pop("start_index", None)
    run.pop("final_z", None)
    run.pop("memory_survival", None)
    run["passage"] = passage
    run["id"] = f"{passage}__native__{run['optimizer']}"
    for frame in run["trace"]:
        if "metric_after" not in frame:
            frame["metric_after"] = frame.get("active_metric", frame.get("trusted_metric"))
        if "metric_before" not in frame:
            frame["metric_before"] = frame.get("trusted_metric", frame["metric_after"])

workspace = {
    "schema_version": "0.3.0",
    "name": "Frozen Projective SORF-LS surface diagnostics",
    "created_at": datetime.now(timezone.utc).isoformat(),
    "source": "experiments/projective_sorf_real_benchmarks/results/surfaces",
    "passages": [
        {
            "id": "surface_quadratic", "label": "Quadratic bowl",
            "purpose": "Convex regression gate", "kind": "surface",
            "surface": {"function": "quadratic", "x_domain": [-5.0, 5.0], "y_domain": [-5.0, 5.0], "optimum": [0.0, 0.0]},
            "horizon": 1, "dt": 1.0, "initial_state": [4.5, -4.0], "target_state": [0.0, 0.0],
        },
        {
            "id": "surface_rastrigin", "label": "Rastrigin landscape",
            "purpose": "Non-convex changing-curvature benchmark", "kind": "surface",
            "surface": {"function": "rastrigin", "x_domain": [-5.12, 5.12], "y_domain": [-5.12, 5.12], "optimum": [0.0, 0.0]},
            "horizon": 1, "dt": 1.0, "initial_state": [4.2, 3.6], "target_state": [0.0, 0.0],
        },
    ],
    "runs": selected,
}
TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_text(json.dumps(workspace, separators=(",", ":")))
print(f"Exported {len(selected)} runs to {TARGET}")
