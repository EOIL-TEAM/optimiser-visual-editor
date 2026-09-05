"""Generate genuine-kernel counterfactual continuations from recorded SORF elections.

The admitted kernel is imported unchanged. Each branch begins at the retained
post-election observation; only the active metric/update family differs.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


APP_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = APP_ROOT.parent
EXPERIMENT_ROOT = WORKSPACE_ROOT.parent / "ARENA_QUADROTOR_EXPERIMENT"
RESULTS_ROOT = EXPERIMENT_ROOT / "results" / "declared_suite"
OUTPUT = APP_ROOT / "public" / "data" / "branch-analyses.json"
CHECKPOINT_OUTPUT = APP_ROOT / "public" / "data" / "branch-checkpoints.npz"

for path in (WORKSPACE_ROOT, EXPERIMENT_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from quadrotor_experiment.optimizers import RunSettings, run_baseline, run_sorf
from quadrotor_experiment.representations import (
    fixed_linear_shear,
    fixed_nonlinear_cubic,
    identity_representation,
)
from run_suite import PASSAGES, _make_objective


BRANCHES = (
    ("elected", "Elected candidate", "sorf", 1.0),
    ("parent", "Retained parent", "sorf", 0.0),
    ("blend_25", "Controlled candidate 25%", "sorf", 0.25),
    ("blend_50", "Controlled candidate 50%", "sorf", 0.50),
    ("blend_75", "Controlled candidate 75%", "sorf", 0.75),
    ("parent_bfgs", "Parent + BFGS updates", "bfgs", 0.0),
    ("candidate_bfgs", "Candidate + BFGS updates", "bfgs", 1.0),
)


def metric_summary(metric: np.ndarray) -> dict:
    eigenvalues, eigenvectors = np.linalg.eigh(0.5 * (metric + metric.T))
    sign, logdet = np.linalg.slogdet(metric)
    return {
        "minimum_eigenvalue": float(eigenvalues[0]),
        "maximum_eigenvalue": float(eigenvalues[-1]),
        "condition_number": float(eigenvalues[-1] / eigenvalues[0]),
        "determinant_sign": float(sign),
        "log_abs_determinant": float(logdet),
        "eigenvalue_quantiles": np.quantile(eigenvalues, [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]).tolist(),
    }, eigenvalues, eigenvectors


def interpolate_spd(parent: np.ndarray, candidate: np.ndarray, amount: float) -> np.ndarray:
    """Affine-invariant SPD interpolation; equal endpoint determinants stay equal."""
    if amount == 0.0:
        return parent.copy()
    if amount == 1.0:
        return candidate.copy()
    parent_values, parent_vectors = np.linalg.eigh(0.5 * (parent + parent.T))
    parent_sqrt = (parent_vectors * np.sqrt(parent_values)) @ parent_vectors.T
    parent_inv_sqrt = (parent_vectors * (1.0 / np.sqrt(parent_values))) @ parent_vectors.T
    relative = parent_inv_sqrt @ candidate @ parent_inv_sqrt
    relative_values, relative_vectors = np.linalg.eigh(0.5 * (relative + relative.T))
    if np.any(relative_values <= 0):
        raise ValueError("candidate is not positive definite in the parent frame")
    relative_power = (relative_vectors * (relative_values**amount)) @ relative_vectors.T
    interpolated = parent_sqrt @ relative_power @ parent_sqrt
    return 0.5 * (interpolated + interpolated.T)


def representation_for(name: str, declaration, model, dimension: int):
    if name == "native":
        return identity_representation(dimension)
    if name == "fixed_linear_shear":
        return fixed_linear_shear(declaration.horizon, model.hover_thrust, 1.0)
    if name == "fixed_nonlinear_cubic":
        return fixed_nonlinear_cubic(declaration.horizon, model.hover_thrust, 0.1, strength=1.0)
    raise ValueError(f"unsupported representation {name}")


def system_summary(objective, native: np.ndarray) -> dict:
    passage = objective.passage(native)
    states = passage["states"]
    controls = passage["controls"]
    forces = passage["paired_rotor_forces"]
    target = objective.config.target_state
    max_force = objective.config.rotor_force_max
    low = np.maximum(-forces, 0.0)
    high = np.maximum(forces - max_force, 0.0)
    violation = low + high
    position_errors = np.linalg.norm(states[:, :2] - target[:2], axis=1)
    return {
        "terminal_position_error": float(position_errors[-1]),
        "maximum_position_error": float(np.max(position_errors)),
        "terminal_attitude_error": float(abs(states[-1, 2] - target[2])),
        "control_energy": float(objective.model.config.dt * np.sum(controls**2)),
        "minimum_rotor_force": float(np.min(forces)),
        "maximum_rotor_force": float(np.max(forces)),
        "constraint_violation_count": int(np.count_nonzero(violation)),
        "maximum_constraint_violation": float(np.max(violation)),
        "trajectory": states[:, :3].tolist(),
    }


def diagnostic_ray(objective, representation, z: np.ndarray, direction: np.ndarray, base_value: float):
    values = []
    first_improving_exponent = None
    for exponent in range(31):
        alpha = 2.0**(-exponent)
        value = float(objective(representation.phi(z + alpha * direction))[0])
        values.append(value)
        if first_improving_exponent is None and value < base_value:
            first_improving_exponent = exponent
    return values, first_improving_exponent


def branch_result(branch_id, label, family, amount, objective, representation, z, parent, candidate, continuation_iterations):
    metric = interpolate_spd(parent, candidate, amount)
    _, native_gradient = objective(representation.phi(z))
    operative_gradient = representation.vjp(z, native_gradient)
    direction = -np.linalg.solve(metric, operative_gradient)
    native_direction = representation.jacobian_at(z) @ direction
    metric_info, eigenvalues, eigenvectors = metric_summary(metric)
    gradient_norm = np.linalg.norm(operative_gradient)
    direction_norm = np.linalg.norm(direction)
    gradient_alignment = float((-operative_gradient @ direction) / (gradient_norm * direction_norm))
    min_alignment = float(abs(operative_gradient @ eigenvectors[:, 0]) / gradient_norm)
    max_alignment = float(abs(operative_gradient @ eigenvectors[:, -1]) / gradient_norm)
    base_value = float(objective(representation.phi(z))[0])
    ray_values, first_improving_exponent = diagnostic_ray(
        objective, representation, z, direction, base_value
    )
    settings = RunSettings(max_iterations=continuation_iterations)
    if family == "sorf":
        result = run_sorf(objective, representation, z.copy(), metric.copy(), settings)
    else:
        result = run_baseline("bfgs", objective, representation, z.copy(), metric.copy(), settings)

    trace = result["trace"]
    immediate_native = z.copy() if not trace else np.asarray(trace[0]["native_after"], dtype=float)
    final_native = np.asarray(result["final_native"], dtype=float)
    values = [base_value] + [float(frame["value_after"]) for frame in trace]
    cumulative_evaluations = [1]
    for frame in trace:
        cumulative_evaluations.append(cumulative_evaluations[-1] + len(frame["line_search_trials"]))
    final_reduction = base_value - float(result["final_value"])
    return {
        "id": branch_id,
        "label": label,
        "family": family,
        "interpolation": amount,
        "start_value": base_value,
        "final_value": float(result["final_value"]),
        "stop_reason": result["stop_reason"],
        "iterations": len(trace),
        "adoptions": int(sum(frame["adopted"] for frame in trace)),
        "objective_evaluations": int(result["objective_evaluations"]),
        "objective_efficiency": float(final_reduction / max(1, result["objective_evaluations"])),
        "direction": {
            "operative_norm": float(direction_norm),
            "native_norm": float(np.linalg.norm(native_direction)),
            "directional_derivative": float(operative_gradient @ direction),
            "cosine_to_negative_gradient": gradient_alignment,
            "gradient_alignment_minimum_eigenvector": min_alignment,
            "gradient_alignment_maximum_eigenvector": max_alignment,
            "native_components": native_direction.tolist(),
        },
        "metric": metric_info,
        "immediate": {
            "adopted": bool(trace and trace[0]["adopted"]),
            "alpha": None if not trace else trace[0]["alpha"],
            "value": base_value if not trace else float(trace[0]["value_after"]),
            "reduction": 0.0 if not trace else float(base_value - trace[0]["value_after"]),
            "line_search_values": [] if not trace else [float(item["value"]) for item in trace[0]["line_search_trials"]],
            "diagnostic_ray_values": ray_values,
            "first_improving_exponent": first_improving_exponent,
            "system": system_summary(objective, immediate_native),
        },
        "multi": {
            "values": values,
            "cumulative_evaluations": cumulative_evaluations,
            "conditions": [float(frame["metric_after"]["condition_number"]) for frame in trace],
            "native_gradient_norms": [float(frame["native_gradient_norm"]) for frame in trace],
            "final_system": system_summary(objective, final_native),
        },
    }


def analyse_event(declaration, run_path: Path, event_iteration: int, continuation_iterations: int):
    run = json.loads(run_path.read_text(encoding="utf-8"))
    frame = run["trace"][event_iteration]
    if not frame["elected"]:
        raise ValueError(f"iteration {event_iteration} in {run_path.name} is not an election")
    matrices = np.load(run_path.with_name(run_path.stem + "_matrices.npz"))["metric_history"]
    parent = np.asarray(matrices[event_iteration], dtype=float)
    candidate = np.asarray(matrices[event_iteration + 1], dtype=float)
    z = np.asarray(frame["z_after"], dtype=float)
    model, objective = _make_objective(declaration)
    representation = representation_for(run["representation"], declaration, model, len(z))
    native = representation.phi(z)
    checkpoint_value, native_gradient = objective(native)
    operative_gradient = representation.vjp(z, native_gradient)
    branches = [
        branch_result(branch_id, label, family, amount, objective, representation, z, parent, candidate, continuation_iterations)
        for branch_id, label, family, amount in BRANCHES
    ]

    original_tail = run["trace"][event_iteration + 1 : event_iteration + 1 + continuation_iterations]
    elected = branches[0]
    compared = min(len(original_tail), len(elected["multi"]["values"]) - 1)
    residuals = [
        abs(float(original_tail[index]["value_after"]) - elected["multi"]["values"][index + 1])
        for index in range(compared)
    ]
    event_id = f"{declaration.name}__{run['representation']}__sorf__election_{event_iteration}"
    analysis = {
        "id": event_id,
        "run_id": f"{declaration.name}__{run['representation']}__sorf",
        "passage": declaration.name,
        "representation": run["representation"],
        "election_iteration": event_iteration,
        "outcome": "failed_next_extension" if original_tail and not original_tail[0]["adopted"] else "survived_next_extension",
        "checkpoint": {
            "archive_key": event_id,
            "value": float(frame["value_after"]),
            "native_gradient_norm": float(frame["native_gradient_norm"]),
            "parent_metric": metric_summary(parent)[0],
            "candidate_metric": metric_summary(candidate)[0],
            "election_scores": frame["scores"],
            "s_norm": None if frame["s"] is None else float(np.linalg.norm(frame["s"])),
            "p_norm": None if frame["p"] is None else float(np.linalg.norm(frame["p"])),
            "r_norm": None if frame["r"] is None else float(np.linalg.norm(frame["r"])),
            "q": frame["q"],
        },
        "reproduction": {
            "compared_iterations": compared,
            "maximum_value_residual": max(residuals, default=0.0),
            "passed": max(residuals, default=0.0) < 1e-9,
        },
        "branches": branches,
    }
    checkpoint_arrays = {
        f"{event_id}__operative_point": z,
        f"{event_id}__native_point": native,
        f"{event_id}__native_gradient": native_gradient,
        f"{event_id}__operative_gradient": operative_gradient,
        f"{event_id}__parent_metric": parent,
        f"{event_id}__candidate_metric": candidate,
        f"{event_id}__s": np.asarray(frame["s"], dtype=float),
        f"{event_id}__p": np.asarray(frame["p"], dtype=float),
        f"{event_id}__r": np.asarray(frame["r"], dtype=float),
        f"{event_id}__q": np.asarray([frame["q"]], dtype=float),
        f"{event_id}__value": np.asarray([checkpoint_value], dtype=float),
    }
    return analysis, checkpoint_arrays


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="analyse every recorded SORF election")
    parser.add_argument("--iterations", type=int, default=12)
    args = parser.parse_args()
    declarations = {item.name: item for item in PASSAGES}
    requested = None if args.all else {("short_aggressive", "native", 3), ("short_aggressive", "native", 44)}
    analyses = []
    checkpoint_arrays = {}
    for passage_id, declaration in declarations.items():
        for run_path in sorted((RESULTS_ROOT / passage_id).glob("*__sorf.json")):
            representation = run_path.stem.split("__", 1)[0]
            run = json.loads(run_path.read_text(encoding="utf-8"))
            for frame in run["trace"]:
                if not frame["elected"]:
                    continue
                key = (passage_id, representation, frame["iteration"])
                if requested is not None and key not in requested:
                    continue
                print(f"Analysing {passage_id} / {representation} / election {frame['iteration']}", flush=True)
                analysis, frozen = analyse_event(declaration, run_path, frame["iteration"], args.iterations)
                analyses.append(analysis)
                checkpoint_arrays.update(frozen)

    output = {
        "schema_version": "0.2.0",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "continuation_iterations": args.iterations,
        "engine": "admitted sorf_return_kernel + declared quadrotor objective",
        "analyses": analyses,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, separators=(",", ":")), encoding="utf-8")
    np.savez_compressed(CHECKPOINT_OUTPUT, **checkpoint_arrays)
    print(f"Wrote {len(analyses)} analyses to {OUTPUT} ({OUTPUT.stat().st_size / 1_000_000:.2f} MB)")
    print(f"Froze {len(analyses)} complete checkpoints in {CHECKPOINT_OUTPUT} ({CHECKPOINT_OUTPUT.stat().st_size / 1_000_000:.2f} MB)")


if __name__ == "__main__":
    main()
