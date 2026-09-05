"""Export the admitted quadrotor suite into the OVE workspace interchange format."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXPERIMENT_ROOT = APP_ROOT.parent.parent / "ARENA_QUADROTOR_EXPERIMENT"
OUTPUT = APP_ROOT / "public" / "data" / "quadrotor-workspace.json"

PASSAGES = {
    "lateral_climb": ("Lateral climb", "Coupled translation and attitude", 60, [0, 0, 0, 0, 0, 0], [2, 2, 0, 0, 0, 0]),
    "vertical_climb": ("Vertical climb", "Symmetric thrust-dominated passage", 60, [0, 0, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0]),
    "lateral_hold": ("Lateral hold", "Attitude-mediated translation at altitude", 60, [0, 1, 0, 0, 0, 0], [2, 1, 0, 0, 0, 0]),
    "disturbed_recovery": ("Disturbed recovery", "Recovery from position, velocity and attitude error", 60, [-1, 1, 0.15, 0.4, -0.2, 0.1], [1, 1.5, 0, 0, 0, 0]),
    "descent_transfer": ("Descent transfer", "Coupled descent and lateral transfer", 60, [0, 2, 0, -0.2, 0, 0], [1, 0.5, 0, 0, 0, 0]),
    "short_aggressive": ("Short aggressive", "Reduced horizon and control authority", 40, [0, 0, 0, 0, 0, 0], [1.5, 1.5, 0, 0, 0, 0]),
    "long_transfer": ("Long transfer", "Longer return chain and increased dimension", 80, [0, 0, 0, 0, 0, 0], [3, 1.5, 0, 0, 0, 0]),
}


def main() -> None:
    experiment_root = DEFAULT_EXPERIMENT_ROOT
    results_root = experiment_root / "results" / "declared_suite"
    if not results_root.exists():
        raise SystemExit(f"Quadrotor suite not found at {results_root}")

    runs = []
    for passage_id in PASSAGES:
        for trace_path in sorted((results_root / passage_id).glob("*__*.json")):
            raw = json.loads(trace_path.read_text(encoding="utf-8"))
            raw["id"] = f"{passage_id}__{raw['representation']}__{raw['optimizer']}"
            raw["passage"] = passage_id
            raw.pop("final_z", None)
            raw.pop("final_native", None)
            raw.pop("final_local_action_minimum", None)
            raw.pop("final_local_action_maximum", None)
            runs.append(raw)

    passages = []
    for passage_id, (label, purpose, horizon, initial, target) in PASSAGES.items():
        passages.append({
            "id": passage_id,
            "label": label,
            "purpose": purpose,
            "horizon": horizon,
            "dt": 0.05,
            "initial_state": initial,
            "target_state": target,
        })

    workspace = {
        "schema_version": "0.1.0",
        "name": "SORF Quadrotor Empirical Suite",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "ARENA_QUADROTOR_EXPERIMENT/results/declared_suite",
        "passages": passages,
        "runs": runs,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(workspace, separators=(",", ":")), encoding="utf-8")
    print(f"Exported {len(runs)} runs to {OUTPUT} ({OUTPUT.stat().st_size / 1_000_000:.1f} MB)")


if __name__ == "__main__":
    main()
