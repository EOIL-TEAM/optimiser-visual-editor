"""Export the admitted quadrotor suite into the OVE workspace interchange format."""

from __future__ import annotations

import json
import gzip
import argparse
from datetime import datetime, timezone
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXPERIMENT_ROOT = APP_ROOT.parent / "arena-sorf-quadrotor" / "ARENA_QUADROTOR_EXPERIMENT"
OUTPUT = APP_ROOT / "public" / "data" / "quadrotor-workspace.json"

PASSAGES = {
    "lateral_climb": ("Lateral climb", "Coupled translation and attitude", 60, [0, 0, 0, 0, 0, 0], [2, 2, 0, 0, 0, 0]),
    "vertical_climb": ("Vertical climb", "Symmetric thrust-dominated passage", 60, [0, 0, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0]),
    "lateral_hold": ("Lateral hold", "Attitude-mediated translation at altitude", 60, [0, 1, 0, 0, 0, 0], [2, 1, 0, 0, 0, 0]),
    "disturbed_recovery": ("Disturbed recovery", "Recovery from position, velocity and attitude error", 60, [-1, 1, 0.15, 0.4, -0.2, 0.1], [1, 1.5, 0, 0, 0, 0]),
    "descent_transfer": ("Descent transfer", "Coupled descent and lateral transfer", 60, [0, 2, 0, -0.2, 0, 0], [1, 0.5, 0, 0, 0, 0]),
    "short_aggressive": ("Short aggressive", "Reduced horizon and control authority", 40, [0, 0, 0, 0, 0, 0], [1.5, 1.5, 0, 0, 0, 0]),
    "long_transfer": ("Long transfer", "Longer return chain and increased dimension", 80, [0, 0, 0, 0, 0, 0], [3, 1.5, 0, 0, 0, 0]),
    "diagonal_sprint": ("Diagonal sprint", "Held-out diagonal transfer", 50, [0, 0, 0, 0, 0, 0], [-2, 1.5, 0, 0, 0, 0]),
    "high_descent": ("High descent", "Held-out descent with lateral transfer", 55, [0, 3, 0, 0, 0, 0], [-1, 0.4, 0, 0, 0, 0]),
    "attitude_recovery": ("Attitude recovery", "Held-out recovery from angular and velocity error", 45, [0.5, 1.5, -0.35, 0.2, -0.3, 0.25], [0, 1, 0, 0, 0, 0]),
    "reverse_transfer": ("Reverse transfer", "Long reverse lateral transfer", 65, [2, 0.5, 0, 0, 0, 0], [-2, 1.2, 0, 0, 0, 0]),
    "vertical_drop_hold": ("Vertical drop hold", "Descending recovery with velocity disturbance", 50, [0, 2.5, 0, 0.3, 0, -0.1], [0, 0.8, 0, 0, 0, 0]),
    "fast_lateral_brake": ("Fast lateral brake", "Capture a fast lateral initial velocity", 45, [-1, 1, 0, 1, 0, 0], [1.5, 1, 0, 0, 0, 0]),
    "offset_hover_recovery": ("Offset hover recovery", "Recover position, attitude and velocity into hover", 60, [1, -0.5, 0.2, 0.2, 0.1, -0.15], [0, 1.5, 0, 0, 0, 0]),
    "long_diagonal": ("Long diagonal", "Long-horizon diagonal transfer", 90, [0, 0, 0, 0, 0, 0], [-3, 2.5, 0, 0, 0, 0]),
    "short_vertical_burst": ("Short vertical burst", "Short-horizon vertical manoeuvre", 35, [0, 0, 0, 0, 0, 0], [0.4, 1.8, 0, 0, 0, 0]),
    "descending_reverse": ("Descending reverse", "Reverse transfer while descending", 70, [2, 2, 0, 0, 0, 0], [-1, 0.3, 0, 0, 0, 0]),
    "tilted_launch": ("Tilted launch", "Launch from attitude and velocity disturbance", 55, [0, 0, 0.4, 0.3, 0, -0.2], [2, 1, 0, 0, 0, 0]),
    "velocity_capture": ("Velocity capture", "Capture mixed initial velocity", 60, [-1, 1, 0, -0.8, 0.4, 0], [1, 1, 0, 0, 0, 0]),
    "high_lateral_hold": ("High lateral hold", "High-altitude lateral hold transfer", 75, [0, 3, 0, 0, 0, 0], [2.5, 3, 0, 0, 0, 0]),
    "compact_recovery": ("Compact recovery", "Short recovery from mixed state error", 40, [0.5, 0.8, -0.2, -0.4, 0.3, 0.15], [-0.5, 1.2, 0, 0, 0, 0]),
    "extended_descent": ("Extended descent", "Long-horizon descent and transfer", 85, [-2, 3, 0, 0.2, -0.3, 0], [2, 0.5, 0, 0, 0, 0]),
}

HISTORICAL_PASSAGES = tuple(list(PASSAGES)[:7])
FULL_MATRIX_PASSAGES = {"short_aggressive", "diagonal_sprint"}
FRAME_FIELDS = {
    "iteration", "value_before", "value_after", "adopted", "alpha",
    "line_search_trials", "native_gradient_norm", "direction_norm",
    "native_movement_norm", "standing", "nominated", "ordeal_fired",
    "elected", "refused", "scores", "s", "p", "r", "q",
    "native_after", "metric_after", "elapsed_seconds",
}
RUN_FIELDS = {
    "id", "passage", "optimizer", "representation", "trace", "stop_reason",
    "objective_evaluations", "final_value", "wall_seconds", "timings",
}


def rounded(value):
    if isinstance(value, float):
        return round(value, 7)
    if isinstance(value, list):
        return [rounded(item) for item in value]
    if isinstance(value, dict):
        return {key: rounded(item) for key, item in value.items()}
    return value


def normalize_run(raw: dict, passage_id: str) -> dict:
    raw["id"] = f"{passage_id}__{raw['representation']}__{raw['optimizer']}"
    raw["passage"] = passage_id
    raw.pop("final_z", None)
    raw.pop("final_native", None)
    raw.pop("final_local_action_minimum", None)
    raw.pop("final_local_action_maximum", None)
    raw.pop("memory_survival", None)
    compact_trace = []
    for frame in raw["trace"]:
        # Quadrotor playback uses physical controls. Dropping the duplicate
        # operative vector keeps the browser payload small without changing
        # any plotted result or replayed flight.
        frame.pop("z_after", None)
        if "metric_after" not in frame:
            frame["metric_after"] = frame.get("active_metric", frame.get("trusted_metric"))
        compact_trace.append(rounded({
            key: value for key, value in frame.items() if key in FRAME_FIELDS
        }))
    raw["trace"] = compact_trace
    return rounded({key: value for key, value in raw.items() if key in RUN_FIELDS})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--experiment-root", type=Path, default=DEFAULT_EXPERIMENT_ROOT)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    experiment_root = args.experiment_root.resolve()
    results_root = experiment_root / "experiments" / "projective_sorf_real_benchmarks" / "results" / "quadrotor"
    if not results_root.exists():
        raise SystemExit(f"Quadrotor suite not found at {results_root}")

    runs = []
    for passage_id in HISTORICAL_PASSAGES:
        for trace_path in sorted((results_root / passage_id).glob("*__*.json")):
            raw = json.loads(trace_path.read_text(encoding="utf-8"))
            runs.append(normalize_run(raw, passage_id))

    prospective_path = experiment_root / "experiments" / "projective_sorf_v1_prospective" / "results" / "runs.json"
    if not prospective_path.exists():
        raise SystemExit(f"Prospective v1 suite not found at {prospective_path}")
    for raw in json.loads(prospective_path.read_text(encoding="utf-8")):
        runs.append(normalize_run(raw, raw["passage"]))

    structured_path = experiment_root / "experiments" / "structured_solver_decision" / "results" / "runs.json.gz"
    if structured_path.exists():
        with gzip.open(structured_path, "rt") as handle:
            structured = json.load(handle)
        grouped = {}
        for raw in structured:
            grouped.setdefault((raw["passage"], raw["representation"], raw["optimizer"]), []).append(raw)
        chosen = []
        for key, candidates in grouped.items():
            ordered = sorted(candidates, key=lambda item: item["wall_seconds"])
            chosen.append(ordered[len(ordered) // 2])
        # The decision workspace is intentionally frozen to the five methods
        # in the predeclaration. Historical variants remain available in their
        # archived workspaces but would obscure this comparison and more than
        # double the browser payload.
        runs = [normalize_run(raw, raw["passage"]) for raw in chosen]

    certified_path = experiment_root / "experiments" / "certified_pcg_decision" / "results" / "runs.json.gz"
    if certified_path.exists():
        with gzip.open(certified_path, "rt") as handle:
            certified = json.load(handle)
        grouped = {}
        for raw in certified:
            grouped.setdefault(
                (raw["passage"], raw["representation"], raw["optimizer"]), []
            ).append(raw)
        chosen = []
        for candidates in grouped.values():
            ordered = sorted(candidates, key=lambda item: item["wall_seconds"])
            chosen.append(ordered[len(ordered) // 2])
        replaced = {
            (raw["passage"], raw["representation"], raw["optimizer"])
            for raw in chosen
        }
        runs = [
            raw
            for raw in runs
            if (raw["passage"], raw["representation"], raw["optimizer"])
            not in replaced
        ]
        runs.extend(normalize_run(raw, raw["passage"]) for raw in chosen)

    # Every passage retains the full native comparison. The two principal
    # diagnostic passages also retain the complete representation matrix.
    # This keeps the bundled application responsive without changing any
    # displayed run or iteration within the admitted subset.
    runs = [
        run for run in runs
        if run["representation"] == "native"
        or run["passage"] in FULL_MATRIX_PASSAGES
    ]

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
        "name": "Certified PCG Decision · 22 passages",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "certified_pcg_decision + structured_solver_decision + frozen baselines",
        "passages": passages,
        "runs": runs,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(workspace, separators=(",", ":")), encoding="utf-8")
    print(f"Exported {len(runs)} runs to {args.output} ({args.output.stat().st_size / 1_000_000:.1f} MB)")


if __name__ == "__main__":
    main()
