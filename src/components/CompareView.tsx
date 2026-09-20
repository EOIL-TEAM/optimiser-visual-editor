import { Activity, AlertTriangle, CheckCircle2, GitCompareArrows, Layers3 } from "lucide-react";
import { useMemo, useState } from "react";
import type { OptimizerRun, PassageDefinition } from "../types";
import { formatNumber, optimizerLabel, representationLabel } from "../lib/format";
import { simulatePassage } from "../lib/physics";
import { LineChart, Panel } from "./Charts";
import { evaluateSurface } from "./SurfaceViewport";

interface Props {
  runs: OptimizerRun[];
  passage: PassageDefinition;
  representation: string;
  onRepresentation: (value: string) => void;
  onOpenRun: (id: string, index?: number) => void;
}

const COLOURS: Record<string, string> = { sorf: "#ffb357", transient_sorf: "#a7f3d0", projective_sorf_ls_v0: "#34d399", projective_sorf_ls_v1: "#f5c451", bfgs: "#7bdff2", lbfgs_m10: "#c4b5fd", structural_gauss_newton: "#fb7185", certified_structural_gauss_newton: "#f97316", certified_warm_start_gauss_newton: "#a78bfa", exact_newton_trust_region: "#60a5fa", steepest_descent: "#c4b5fd" };

type BudgetAxis = "time" | "calls" | "iterations";

function cumulativeCalls(run: OptimizerRun, index: number) {
  return 1 + run.trace.slice(0, index + 1).reduce((sum, frame) => sum + frame.line_search_trials.length, 0);
}

function frameBudget(run: OptimizerRun, index: number, axis: BudgetAxis) {
  if (axis === "time") return run.trace[index]?.elapsed_seconds ?? index + 1;
  if (axis === "calls") return cumulativeCalls(run, index);
  return index + 1;
}

function retainedIndex(run: OptimizerRun, axis: BudgetAxis, deadline: number) {
  let retained = -1;
  run.trace.forEach((frame, index) => { if (frame.adopted && frameBudget(run, index, axis) <= deadline) retained = index; });
  return retained;
}

function retainedValue(run: OptimizerRun, axis: BudgetAxis, deadline: number) {
  const index = retainedIndex(run, axis, deadline);
  return index < 0 ? (run.trace[0]?.value_before ?? run.final_value) : run.trace[index].value_after;
}

export function CompareView({ runs, passage, representation, onRepresentation, onOpenRun }: Props) {
  const [axis, setAxis] = useState<BudgetAxis>("time");
  const [budgetPercent, setBudgetPercent] = useState(100);
  const availableRepresentations = [...new Set(runs.map((run) => run.representation))];
  const selected = runs.filter((run) => run.representation === representation);
  const reference = selected.find((run) => run.optimizer === "bfgs") ?? selected[0];
  const referenceMaximum = reference ? (axis === "time" ? (reference.wall_seconds ?? reference.trace.at(-1)?.elapsed_seconds ?? reference.trace.length) : axis === "calls" ? reference.objective_evaluations : reference.trace.length) : 1;
  const deadline = referenceMaximum * budgetPercent / 100;
  const matched = selected.map((run) => ({ run, index: retainedIndex(run, axis, deadline), value: retainedValue(run, axis, deadline) }));
  const flights = useMemo(() => passage.kind === "surface" ? [] : matched.map(({ run, index }) => ({ run, samples: simulatePassage(index < 0 ? Array(passage.horizon * 2).fill(0) : run.trace[index].native_after, passage) })), [selected, passage, axis, deadline]);
  const convergence = selected.map((run) => ({
    label: optimizerLabel(run.optimizer), colour: COLOURS[run.optimizer] ?? "#fff",
    values: Array.from({ length: 61 }, (_, index) => retainedValue(run, axis, referenceMaximum * 2 * index / 60)),
  }));
  return (
    <main className="compare-view scrollable">
      <div className="view-intro">
        <div><span className="eyebrow">Comparison room</span><h1>Same problem. Different search behaviour.</h1><p>Compare retained objective, physical consequence and failure mode under an identical representation.</p></div>
        <div><div className="segmented-control">
          {availableRepresentations.map((value) => <button key={value} className={representation === value ? "active" : ""} onClick={() => onRepresentation(value)}>{representationLabel(value)}</button>)}
        </div><div className="segmented-control budget-axis">{(["time", "calls", "iterations"] as BudgetAxis[]).map((value) => <button key={value} className={axis === value ? "active" : ""} onClick={() => setAxis(value)}>{value === "time" ? "Wall time" : value}</button>)}</div></div>
      </div>
      <div className="budget-control"><label>Shared budget <strong>{budgetPercent}% BFGS {axis}</strong></label><input type="range" min="0" max="200" step="5" value={budgetPercent} onChange={(event) => setBudgetPercent(Number(event.target.value))} /><span>{axis === "time" ? `${formatNumber(deadline * 1000, 2)} ms` : formatNumber(deadline, 1)}</span></div>
      <div className="compare-cards">
        {matched.map(({ run, index, value }) => {
          const initial = run.trace[0]?.value_before ?? run.final_value;
          const reduction = 100 * (1 - value / initial);
          const elections = run.trace.filter((frame) => frame.elected).length;
          const failed = run.stop_reason === "line_search_failed";
          return (
            <button className="compare-card" key={run.id} onClick={() => onOpenRun(run.id)}>
              <div className="compare-card-title"><span className={`optimizer-mark optimizer-${run.optimizer}`}>{run.optimizer.includes("sorf") ? <Activity /> : run.optimizer === "bfgs" ? <GitCompareArrows /> : <Layers3 />}</span><div><small>Optimiser</small><strong>{optimizerLabel(run.optimizer)}</strong></div><span className={`outcome-chip ${failed ? "failure" : "success"}`}>{failed ? <AlertTriangle /> : <CheckCircle2 />}{failed ? "Stopped" : "Complete"}</span></div>
              <div className="compare-primary-value"><strong>{formatNumber(value, 5)}</strong><small>retained at shared budget</small></div>
              <div className="compare-stat-row"><span>Reduction <b>{formatNumber(reduction, 1)}%</b></span><span>Delivered step <b>{index + 1}</b></span><span>Total <b>{formatNumber((run.wall_seconds ?? 0) * 1000, 1)} ms</b></span></div>
              {run.timings && <div className="cost-strip" title="setup / derivatives / solve / search"><i style={{ flex: run.timings.setup_seconds }} /><i style={{ flex: run.timings.derivative_seconds }} /><i style={{ flex: run.timings.solve_seconds }} /><i style={{ flex: run.timings.search_seconds }} /></div>}
              <div className="micro-chart"><LineChart height={70} logScale series={[{ label: optimizerLabel(run.optimizer), values: [initial, ...run.trace.map((frame) => frame.value_after)], colour: COLOURS[run.optimizer] ?? "#fff" }]} /></div>
            </button>
          );
        })}
      </div>
      <div className="compare-grid">
        <Panel title="Objective convergence" eyebrow={`${axis} · 0–200% of BFGS reference`} className="compare-objective">
          <LineChart height={250} logScale activeIndex={Math.round(budgetPercent / 200 * 60)} series={convergence} />
        </Panel>
        <Panel title={passage.kind === "surface" ? "Search paths" : "Matched-budget system passage"} eyebrow={`${budgetPercent}% BFGS ${axis}`} className="compare-flight-panel">
          {passage.kind === "surface" ? <ComparisonSurface runs={selected} passage={passage} /> : <ComparisonFlight flights={flights} passage={passage} />}
        </Panel>
      </div>
      <Panel title="Representation-sensitive outcomes" eyebrow="Evidence matrix">
        <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Optimiser</th><th>Representation</th><th>Final objective</th><th>Iterations</th><th>Setup</th><th>Derivatives</th><th>Solve</th><th>Search</th><th>Lifecycle</th></tr></thead><tbody>
          {runs.map((run) => <tr key={run.id} onClick={() => onOpenRun(run.id)}><td><i style={{ background: COLOURS[run.optimizer] }} />{optimizerLabel(run.optimizer)}</td><td>{representationLabel(run.representation)}</td><td>{formatNumber(run.final_value)}</td><td>{run.trace.length}</td><td>{run.timings ? `${formatNumber(run.timings.setup_seconds * 1000, 2)} ms` : "—"}</td><td>{run.timings ? `${formatNumber(run.timings.derivative_seconds * 1000, 2)} ms` : "—"}</td><td>{run.timings ? `${formatNumber(run.timings.solve_seconds * 1000, 2)} ms` : "—"}</td><td>{run.timings ? `${formatNumber(run.timings.search_seconds * 1000, 2)} ms` : "—"}</td><td><span className={run.stop_reason === "line_search_failed" ? "danger-text" : "success-text"}>{run.stop_reason === "line_search_failed" ? "Line search stopped" : "Passage completed"}</span></td></tr>)}
        </tbody></table></div>
      </Panel>
    </main>
  );
}

function ComparisonSurface({ runs, passage }: { runs: OptimizerRun[]; passage: PassageDefinition }) {
  const width = 720, height = 250, pad = 25;
  const surface = passage.surface!;
  const x = (value: number) => pad + (value - surface.x_domain[0]) / (surface.x_domain[1] - surface.x_domain[0]) * (width - 2 * pad);
  const y = (value: number) => height - pad - (value - surface.y_domain[0]) / (surface.y_domain[1] - surface.y_domain[0]) * (height - 2 * pad);
  const cells = 36;
  const values = Array.from({ length: cells * cells }, (_, index) => {
    const ix = index % cells, iy = Math.floor(index / cells);
    const px = surface.x_domain[0] + (ix / (cells - 1)) * (surface.x_domain[1] - surface.x_domain[0]);
    const py = surface.y_domain[0] + (iy / (cells - 1)) * (surface.y_domain[1] - surface.y_domain[0]);
    return evaluateSurface(passage, px, py);
  });
  const max = Math.max(...values);
  return <svg className="comparison-flight" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
    {values.map((value, index) => { const ix = index % cells, iy = Math.floor(index / cells); return <rect key={index} x={pad + ix * (width - 2 * pad) / cells} y={pad + iy * (height - 2 * pad) / cells} width={(width - 2 * pad) / cells + .5} height={(height - 2 * pad) / cells + .5} fill="#ffb357" opacity={.04 + .23 * value / Math.max(1, max)} />; })}
    {runs.map((run) => { const points = [passage.initial_state, ...run.trace.map((frame) => frame.native_after)]; return <polyline key={run.id} points={points.map((point) => `${x(point[0])},${y(point[1])}`).join(" ")} fill="none" stroke={COLOURS[run.optimizer] ?? "#fff"} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />; })}
    <circle cx={x(surface.optimum[0])} cy={y(surface.optimum[1])} r="6" fill="none" stroke="#fff" strokeWidth="1.5" />
  </svg>;
}

function ComparisonFlight({ flights, passage }: { flights: { run: OptimizerRun; samples: ReturnType<typeof simulatePassage> }[]; passage: PassageDefinition }) {
  const width = 720, height = 250, pad = 30;
  const all = flights.flatMap((item) => item.samples);
  const xs = [...all.map((item) => item.x), passage.target_state[0], passage.initial_state[0]];
  const zs = [...all.map((item) => item.z), passage.target_state[1], passage.initial_state[1], 0];
  const minX = Math.min(...xs) - 0.3, maxX = Math.max(...xs) + 0.3, minZ = Math.min(...zs) - 0.2, maxZ = Math.max(...zs) + 0.35;
  const x = (value: number) => pad + (value - minX) / Math.max(0.1, maxX - minX) * (width - 2 * pad);
  const y = (value: number) => height - pad - (value - minZ) / Math.max(0.1, maxZ - minZ) * (height - 2 * pad);
  return <svg className="comparison-flight" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
    {[0, 0.5, 1].map((ratio) => <line key={ratio} x1={pad} x2={width - pad} y1={pad + ratio * (height - 2 * pad)} y2={pad + ratio * (height - 2 * pad)} className="chart-grid" />)}
    {flights.map(({ run, samples }) => <polyline key={run.id} points={samples.map((item) => `${x(item.x)},${y(item.z)}`).join(" ")} fill="none" stroke={COLOURS[run.optimizer] ?? "#fff"} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />)}
    <g transform={`translate(${x(passage.target_state[0])} ${y(passage.target_state[1])})`} className="target-marker"><circle r="12" /><circle r="3" /></g>
  </svg>;
}
