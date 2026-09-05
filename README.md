# Optimiser Visual Editor

**Understand, debug and compare optimisation systems visually.**

Optimiser Visual Editor (OVE) is a desktop record/replay environment that connects an optimiser's internal decisions to their real-system consequences. It is designed as an optimiser-agnostic workbench; SORF is the first deeply instrumented optimiser inside it, not the product boundary.

## First release

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

The default scene opens the native short-aggressive SORF passage at iteration 44: the second candidate is elected, metric conditioning reaches approximately `1.55e13`, and the following extension fails.

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
