# Optimiser Visual Editor trace format

OVE separates the optimisation process into three inspectable layers:

- **operative coordinates** — the coordinates in which an optimiser proposes movement;
- **native variables** — the variables judged by the problem's objective;
- **application state** — the physical or simulated consequence of those variables.

The bundled `0.1.0` workspace format is a JSON object with workspace metadata, passage definitions, and recorded runs. Each run owns an ordered `trace` of frames.

## Required workspace fields

```json
{
  "schema_version": "0.1.0",
  "name": "Example workspace",
  "created_at": "2026-09-05T12:00:00Z",
  "source": "experiment identifier",
  "passages": [],
  "runs": []
}
```

## Required run fields

```json
{
  "id": "passage__representation__optimizer",
  "passage": "passage",
  "optimizer": "sorf",
  "representation": "native",
  "stop_reason": "maximum_iterations",
  "objective_evaluations": 61,
  "final_value": 0.427415,
  "trace": []
}
```

Frames record the authoritative scalar judgement, adoption decision, line-search trials, coordinate states, movement norms, metric summary, and lifecycle flags. Optimiser-specific evidence such as SORF's `s`, `p`, `r`, `q`, nomination, ordeal, election, and refusal is optional.

OVE treats recorded values as authoritative. Application rollouts and cost decompositions reconstructed by a viewer are labelled as derived evidence.

## Import boundary

The desktop application accepts either a complete OVE workspace or one raw run JSON file from the ARENA quadrotor harness. A raw run is assigned a generic imported passage because the original artifact does not contain all problem metadata.

The next schema revision will add immutable problem manifests, full gradients and directions, objective-component telemetry, system-state channels, constraint channels, units, and event provenance identifiers.

## Counterfactual checkpoint archive

Branch-analysis schema `0.2.0` adds a compressed checkpoint archive keyed by election identifier. Each frozen post-election checkpoint contains:

- operative and native points;
- operative and certified native gradients;
- complete parent and elected-candidate metrics;
- structural evidence `s`, `p`, `r`, and `q`;
- the authoritative scalar judgement.

At an elected post-section state, SORF has no pending candidate. These arrays, the declared representation, and the immutable problem declaration therefore constitute the complete state needed to recreate the next proposal. The callable objective provenance is restored from the declared experiment code rather than serialised.

Every analysis records seven continuations, a historical-reproduction residual, immediate ray values through `2^-30`, twelve-iteration objective histories, metric conditioning, gradient alignment, constraint measurements, and application trajectories. Interpolated candidates follow the affine-invariant SPD geodesic between parent and candidate; because the endpoint determinants agree, the interpolants preserve that determinant.
