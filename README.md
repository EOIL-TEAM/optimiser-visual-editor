# Optimiser Visual Editor

**Understand, debug and compare optimisation systems visually.**

Optimiser Visual Editor (OVE) is a desktop record/replay environment that connects an optimiser's internal decisions to their real-system consequences. It is designed as an optimiser-agnostic workbench; SORF is the first deeply instrumented optimiser inside it, not the product boundary.

## Current release

The application ships with the complete declared SORF quadrotor evidence workspace:

- 63 deterministic traces;
- seven physical passages;
- SORF, BFGS, and fixed-metric steepest descent;
- native, fixed-linear, and fixed-nonlinear representations;
- optimisation and system-time scrubbing;
- animated quadrotor passage reconstruction;
- structured time × control-channel views for high-dimensional decisions;
- objective, gradient, metric-conditioning, and line-search lenses;
- SORF nomination, ordeal, election, refusal, and failure inspection;
- side-by-side optimiser and representation comparisons;
- an indexed evidence room for decisive events;
- import of OVE workspaces and raw ARENA run JSON files.

### Counterfactual Branch Lab

Version 0.2 freezes the complete post-election state at every recorded SORF election and replays seven parallel continuations:

- elected candidate under SORF;
- retained parent under SORF;
- determinant-preserving affine-invariant candidate interpolations at 25%, 50%, and 75%;
- retained parent followed by conventional BFGS updates;
- elected candidate followed by conventional BFGS updates.

The bundled laboratory contains 73 election checkpoints. Each branch is evaluated for immediate line-search reachability and twelve subsequent optimiser iterations, with comparisons of direction scale, gradient alignment, objective efficiency, metric spectrum, constraints, and quadrotor behaviour. Full checkpoint arrays are preserved in `public/data/branch-checkpoints.npz`.

The admitted candidate branch is required to reproduce the historical continuation before its counterfactual siblings are treated as evidence.

The default scene opens the native short-aggressive SORF passage at iteration 44: the second candidate is elected, metric conditioning reaches approximately `1.55e13`, and the following extension fails.

The bundled workspace also includes two conventional two-dimensional optimisation scenes:

- a convex quadratic bowl;
- a non-convex Rastrigin landscape.

Each includes deterministic traces produced by the admitted Python SORF kernel and the matched steepest-descent and full-BFGS harness, with a sampled 3-D objective surface and iteration-by-iteration search path. The editor never synthesises optimiser results. Select either benchmark from the **Problem** menu; the quadrotor passages remain available in the same workspace.

The bundled quadrotor workspace keeps the complete native solver comparison for every passage and the full representation matrix for the short-aggressive and diagonal-sprint diagnostic passages. Raw campaign collections remain in the research repository's checksummed data archive rather than being copied into the desktop bundle. Both exporters accept `--experiment-root` when the research repository is not checked out beside this project.

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

On filesystems that do not support symbolic links, install with `npm install --no-bin-links`. The checked-in scripts call their tools directly, and desktop packaging uses a temporary local assembly directory before copying the finished artifact into `release/`.

Build the web renderer:

```bash
npm run build
```

Build the Linux desktop package:

```bash
npm run dist
```

Regenerate the bundled workspace from the adjacent `ARENA_QUADROTOR_EXPERIMENT` directory:

```bash
npm run export:data
npm run export:branches
```

## Evidence integrity

OVE distinguishes recorded judgement from reconstructed diagnostics. A projection or reconstructed system view can help form a hypothesis, but it is not silently promoted into a causal or structural claim. See [TRACE_FORMAT.md](TRACE_FORMAT.md) for the current interchange boundary.

## Roadmap

1. Record and replay existing optimiser runs faithfully.
2. Add a live telemetry SDK and generic problem adapters.
3. Add checkpoint-and-branch counterfactual experiments.
4. Add representation-difference and high-dimensional sensitivity lenses.
5. Grow SORF inside the workbench while retaining established solvers as baselines.

## Licence

MIT
